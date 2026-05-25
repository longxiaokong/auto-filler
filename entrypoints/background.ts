import { getApiConfig, isApiConfigured, setApiConfig } from '@/utils/storage';
import {
  getAllCategories,
  getAllFileRecords,
  getAllTextFields,
  saveAllTextFields,
} from '@/utils/db';
import { matchFields, matchFieldsStream } from '@/utils/matcher';
import type { Category, FileRecord } from '@/utils/db';
import type { MatchResult, FormFieldInfo, MaterialRole } from '@/utils/matcher';

interface MessageMap {
  startScan: undefined;
  startFill: { matches: MatchResult[] };
}

type MessageType = keyof MessageMap;

interface Request<T extends MessageType> {
  type: T;
  payload: MessageMap[T];
}

interface ErrorResponse {
  ok: false;
  error: string;
}

interface ScanSuccessResponse {
  ok: true;
  type: 'scan';
  total: number;
  matched: number;
  matches: MatchResult[];
  fields: FormFieldInfo[];
}

interface FillSuccessResponse {
  ok: true;
  type: 'fill';
  success: number;
  failure: number;
}

type Response = ScanSuccessResponse | FillSuccessResponse | ErrorResponse;

type ContentFillItem =
  | { kind: 'text'; index: number; value: string }
  | { kind: 'file'; index: number; fileName: string; fileType: string; fileBody: string };

interface RoleScore {
  role: MaterialRole;
  score: number;
  exact: boolean;
}

const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

const MATERIAL_LABELS: Record<MaterialRole, string> = {
  id_photo: '证件照',
  id_card_front: '身份证正面',
  id_card_back: '身份证反面',
};

const ROLE_KEYWORDS: Record<MaterialRole, { exact: string[]; alias: string[] }> = {
  id_photo: {
    exact: ['证件照', '免冠照片', '免冠照', '个人照片', '报名照片'],
    alias: ['照片', '头像'],
  },
  id_card_front: {
    exact: ['身份证正面', '身份证人像面', '身份证头像面'],
    alias: ['人像面', '正面'],
  },
  id_card_back: {
    exact: ['身份证反面', '身份证国徽面'],
    alias: ['国徽面', '反面'],
  },
};

function errorResponse(error: string): ErrorResponse {
  return { ok: false, error };
}

async function getCurrentTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToContentScript<T>(tabId: number, message: unknown): Promise<T> {
  try {
    return await chrome.tabs.sendMessage(tabId, message) as T;
  } catch (err) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-scripts/content.js'],
    });
    return chrome.tabs.sendMessage(tabId, message) as Promise<T>;
  }
}

function normalizeMaterialText(text: string): string {
  return text.replace(/\s+/g, '').toLowerCase();
}

function scoreRole(text: string, role: MaterialRole): RoleScore {
  const normalized = normalizeMaterialText(text);
  const keywords = ROLE_KEYWORDS[role];
  let score = 0;
  let exact = false;

  for (const keyword of keywords.exact) {
    if (normalized.includes(normalizeMaterialText(keyword))) {
      score += 10;
      exact = true;
    }
  }

  for (const keyword of keywords.alias) {
    if (normalized.includes(normalizeMaterialText(keyword))) {
      score += 3;
    }
  }

  if ((role === 'id_card_front' || role === 'id_card_back') && normalized.includes('身份证')) {
    score += 2;
  }
  if (role === 'id_photo' && normalized.includes('个人照片')) {
    score += 3;
  }

  return { role, score, exact };
}

function detectBestRole(text: string): RoleScore | null {
  const scores = (Object.keys(ROLE_KEYWORDS) as MaterialRole[])
    .map((role) => scoreRole(text, role))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scores.length === 0) return null;
  if (scores.length > 1 && scores[0].score === scores[1].score) return null;
  return scores[0];
}

function acceptsFile(accept: string | undefined, filename: string, fileType: string): boolean {
  const rules = (accept ?? '')
    .split(',')
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean);
  if (rules.length === 0) return true;

  const lowerName = filename.toLowerCase();
  const lowerType = fileType.toLowerCase();
  return rules.some((rule) => {
    if (rule === '*/*') return true;
    if (rule.endsWith('/*')) return lowerType.startsWith(rule.slice(0, -1));
    if (rule.startsWith('.')) return lowerName.endsWith(rule);
    return lowerType === rule;
  });
}

function inferImageType(filename: string, fileType: string): string {
  if (fileType) return fileType;
  if (/\.jpe?g$/i.test(filename)) return 'image/jpeg';
  if (/\.png$/i.test(filename)) return 'image/png';
  if (/\.webp$/i.test(filename)) return 'image/webp';
  return '';
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function isSupportedImage(record: FileRecord): boolean {
  const fileType = inferImageType(record.filename, record.fileType).toLowerCase();
  if (SUPPORTED_IMAGE_TYPES.has(fileType)) return true;
  return /\.(jpe?g|png|webp)$/i.test(record.filename);
}

function getCategoryName(record: FileRecord, categoryById: Map<number, Category>): string {
  return categoryById.get(record.categoryId)?.name ?? '';
}

function detectFileFieldRole(field: FormFieldInfo): RoleScore | null {
  const directRole = detectBestRole([
    field.label,
    field.hint,
    field.placeholder,
    field.ariaLabel,
    field.title,
    field.name,
    field.id,
  ].filter(Boolean).join(' '));
  if (directRole) return directRole;

  return detectBestRole([
    field.context,
    field.html,
  ].filter(Boolean).join(' '));
}

function matchFileFields(
  fields: FormFieldInfo[],
  fileRecords: FileRecord[],
  categories: Category[],
): MatchResult[] {
  const categoryById = new Map(categories.flatMap((category) => (
    category.id == null ? [] : [[category.id, category] as const]
  )));
  const fileFields = fields.filter((field) => field.kind === 'file');
  const imageRecords = fileRecords.filter((record) => record.id != null && isSupportedImage(record));

  return fileFields.flatMap((field) => {
    const fieldRole = detectFileFieldRole(field);
    if (!fieldRole) return [];

    const candidates = imageRecords
      .map((record) => {
        const text = [
          record.filename,
          record.fileDescription,
          getCategoryName(record, categoryById),
        ].filter(Boolean).join(' ');
        const materialRole = scoreRole(text, fieldRole.role);
        return { record, materialRole };
      })
      .filter(({ record, materialRole }) => (
        materialRole.score > 0 &&
        acceptsFile(field.accept, record.filename, inferImageType(record.filename, record.fileType))
      ))
      .sort((a, b) => (
        b.materialRole.score - a.materialRole.score ||
        b.record.createdAt - a.record.createdAt
      ));

    const best = candidates[0];
    if (!best?.record.id) return [];

    const confidence: MatchResult['confidence'] =
      fieldRole.exact && best.materialRole.exact
        ? 'high'
        : fieldRole.score >= 5 && best.materialRole.score >= 5
          ? 'medium'
          : 'low';

    return [{
      kind: 'file',
      index: field.index,
      fieldKey: fieldRole.role,
      value: best.record.filename,
      shortLabel: MATERIAL_LABELS[fieldRole.role],
      confidence,
      fileRecordId: best.record.id,
      fileName: best.record.filename,
      fileType: inferImageType(best.record.filename, best.record.fileType),
      materialRole: fieldRole.role,
    }];
  });
}

export default defineBackground(() => {
  if (import.meta.env.DEV) {
    seedDevData();
  }

  chrome.runtime.onMessage.addListener((request: Request<MessageType>, _sender, sendResponse) => {
    handleMessage(request)
      .then(sendResponse)
      .catch((err) => sendResponse(errorResponse(err.message)));

    return true;
  });

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'stream-fill') return;
    port.onMessage.addListener(async (msg) => {
      if (msg.type === 'startStreamScan') {
        await handleStreamScan(port);
      }
    });
  });

  chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'stream-fill') {
      console.log('%c⌨️ 快捷键触发流式填充', 'color:#6C5CE7;font-weight:bold');
      await handleStreamScan();
    }
  });
});

async function seedDevData() {
  const [textFields, apiReady] = await Promise.all([
    getAllTextFields(),
    isApiConfigured(),
  ]);

  const devFields = [
    { key: '姓名', value: '刘智杰' },
    { key: '手机号', value: '13810131217' },
    { key: '地址', value: '安徽省合肥市包河区金寨路96号' },
    { key: '身份证号', value: '340111200502146016' },
    { key: '出生日期', value: '20050214' },
    { key: '民族', value: '汉族' },
    { key: '性别', value: '男' },
    { key: '婚否', value: '未婚' },
    { key: '政治面貌', value: '共青团员' },
    { key: '户籍地址', value: '安徽省合肥市包河区金寨路96号' },
    { key: '邮箱', value: 'liuzhijie@example.com' },
  ];

  const keyAliases: Record<string, string[]> = {
    姓名: ['name'],
    手机号: ['phone'],
    地址: ['address'],
    邮箱: ['email'],
  };
  const existingKeys = new Set(textFields.map((field) => field.key));
  const missingFields = devFields.filter((field) => {
    const aliases = keyAliases[field.key] ?? [];
    return !existingKeys.has(field.key) && aliases.every((alias) => !existingKeys.has(alias));
  });
  if (missingFields.length > 0) {
    await saveAllTextFields([...textFields, ...missingFields]);
  }

  if (!apiReady) {
    await setApiConfig({
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'sk-87f5684509814e7393b0f523b286147d',
      model: 'deepseek-chat',
    });
  }
}

async function handleMessage(request: Request<MessageType>): Promise<Response> {
  if (request.type === 'startScan') {
    return handleScan();
  }
  if (request.type === 'startFill') {
    return handleFill(request.payload!.matches);
  }
  return errorResponse('Unknown message type');
}

async function handleScan(): Promise<Response> {
  const tab = await getCurrentTab();
  if (!tab?.id) return errorResponse('No active tab found');

  const scanResults = await sendToContentScript<
    Array<{ index: number; field: FormFieldInfo }>
  >(tab.id, { type: 'scan' });

  if (!scanResults || scanResults.length === 0) {
    return { ok: true, type: 'scan', total: 0, matched: 0, matches: [], fields: [] };
  }

  const fieldInfos = scanResults.map((r) => ({ ...r.field, index: r.index }));
  const textFieldInfos = fieldInfos.filter((field) => field.kind !== 'file');

  const [textFields, apiConfig, textApiReady, fileRecords, categories] = await Promise.all([
    getAllTextFields(),
    getApiConfig(),
    isApiConfigured(),
    getAllFileRecords(),
    getAllCategories(),
  ]);

  const textMatches = textApiReady ? await matchFields(textFieldInfos, apiConfig, textFields) : [];
  const fileMatches = matchFileFields(fieldInfos, fileRecords, categories);
  const matches = [...textMatches, ...fileMatches];

  return {
    ok: true,
    type: 'scan',
    total: scanResults.length,
    matched: matches.length,
    matches,
    fields: fieldInfos,
  };
}

async function handleFill(
  matches: MatchResult[],
): Promise<Response> {
  const tab = await getCurrentTab();
  if (!tab?.id) return errorResponse('No active tab found');

  const fileMatches = matches.filter((match) => match.kind === 'file' && match.fileRecordId != null);
  const fileRecordById = new Map<number, FileRecord>();
  if (fileMatches.length > 0) {
    const records = await getAllFileRecords();
    for (const record of records) {
      if (record.id != null) fileRecordById.set(record.id, record);
    }
  }

  const items: ContentFillItem[] = [];
  for (const match of matches) {
    if (match.kind === 'file') {
      if (match.fileRecordId == null) continue;
      const record = fileRecordById.get(match.fileRecordId);
      if (!record) continue;
      items.push({
        kind: 'file',
        index: match.index,
        fileName: record.filename,
        fileType: inferImageType(record.filename, record.fileType),
        fileBody: arrayBufferToBase64(await record.fileBody.arrayBuffer()),
      });
    } else {
      items.push({ kind: 'text', index: match.index, value: match.value });
    }
  }

  const result = await sendToContentScript<{ success: number; failure: number }>(
    tab.id,
    { type: 'fill', items },
  );

  return { ok: true, type: 'fill', success: result.success, failure: result.failure };
}

async function handleStreamScan(port?: chrome.runtime.Port): Promise<void> {
  const tab = await getCurrentTab();
  if (!tab?.id) {
    port?.postMessage({ type: 'streamError', error: 'No active tab found' });
    port?.disconnect();
    return;
  }

  const sendProgress = (matched: number, total: number, latestLabel: string) => {
    port?.postMessage({ type: 'streamProgress', matched, total, latestLabel });
  };

  try {
    // 1. Scan fields
    const scanResults = await sendToContentScript<
      Array<{ index: number; field: FormFieldInfo }>
    >(tab.id, { type: 'scan' });

    if (!scanResults || scanResults.length === 0) {
      port?.postMessage({ type: 'streamComplete', matched: 0, errorCount: 0 });
      port?.disconnect();
      return;
    }

    const fieldInfos = scanResults.map((r) => ({ ...r.field, index: r.index }));
    const textFieldInfos = fieldInfos.filter((f) => f.kind !== 'file');
    const totalFields = fieldInfos.length;

    // 2. Load data
    const [textFields, apiConfig, textApiReady, fileRecords, categories] = await Promise.all([
      getAllTextFields(),
      getApiConfig(),
      isApiConfigured(),
      getAllFileRecords(),
      getAllCategories(),
    ]);

    let matched = 0;
    let errorCount = 0;

    // 3. Init content script for streaming
    await sendToContentScript(tab.id, {
      type: 'fillStreamInit',
      items: fieldInfos.map((f) => ({ index: f.index, fillMode: f.fillMode ?? 'short' })),
    });

    // 4. File matches (non-streaming, fill immediately)
    const fileMatches = matchFileFields(fieldInfos, fileRecords, categories);
    const fileRecordById = new Map<number, FileRecord>();
    if (fileMatches.length > 0) {
      const records = await getAllFileRecords();
      for (const r of records) { if (r.id != null) fileRecordById.set(r.id, r); }
    }

    for (const fm of fileMatches) {
      if (fm.fileRecordId == null) continue;
      const record = fileRecordById.get(fm.fileRecordId);
      if (!record) continue;
      try {
        await sendToContentScript(tab.id, {
          type: 'fillField',
          index: fm.index,
          value: fm.value,
        });
        matched++;
        sendProgress(matched, totalFields, fm.shortLabel);
      } catch { errorCount++; }
    }

    // 5. Stream text matches
    if (textApiReady && textFieldInfos.length > 0 && textFields.length > 0) {
      for await (const event of matchFieldsStream(textFieldInfos, apiConfig, textFields)) {
        if (event.type === 'value_chunk') {
          try {
            await sendToContentScript(tab.id, {
              type: 'fillTypeChunk',
              index: event.index,
              chunk: event.chunk,
            });
          } catch { /* tab may have closed */ }
        } else if (event.type === 'match_complete') {
          const match = event.match;
          try {
            if (match.fillMode === 'long') {
              await sendToContentScript(tab.id, {
                type: 'fillTypeCommit',
                index: match.index,
              });
            } else {
              await sendToContentScript(tab.id, {
                type: 'fillField',
                index: match.index,
                value: match.value,
              });
            }
            matched++;
            sendProgress(matched, totalFields, match.shortLabel);
          } catch { errorCount++; }
        }
      }
    }

    // 6. Complete
    try {
      await sendToContentScript(tab.id, { type: 'fillStreamComplete' });
    } catch { /* ignore */ }
    port?.postMessage({ type: 'streamComplete', matched, errorCount });
  } catch (err) {
    port?.postMessage({ type: 'streamError', error: (err as Error).message });
  } finally {
    port?.disconnect();
  }
}
