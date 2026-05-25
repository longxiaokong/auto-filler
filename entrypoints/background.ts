import { getApiConfig, isApiConfigured, setApiConfig } from '@/utils/storage';
import { getAllTextFields, hasTextFields, saveAllTextFields } from '@/utils/db';
import { matchFields } from '@/utils/matcher';
import type { MatchResult, FormFieldInfo } from '@/utils/matcher';

interface MessageMap {
  startScan: undefined;
  startFill: { matches: { index: number; value: string }[] };
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

  const [hasFields, apiReady] = await Promise.all([
    hasTextFields(),
    isApiConfigured(),
  ]);

  if (!hasFields) return errorResponse('请先在设置页录入个人信息');
  if (!apiReady) return errorResponse('请先在设置页配置 API Key');

  const scanResults = await sendToContentScript<
    Array<{ index: number; field: FormFieldInfo }>
  >(tab.id, { type: 'scan' });

  if (!scanResults || scanResults.length === 0) {
    return { ok: true, type: 'scan', total: 0, matched: 0, matches: [], fields: [] };
  }

  const fieldInfos = scanResults.map((r) => ({ ...r.field, index: r.index }));

  const [textFields, apiConfig] = await Promise.all([
    getAllTextFields(),
    getApiConfig(),
  ]);

  const matches = await matchFields(fieldInfos, apiConfig, textFields);

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
  matches: { index: number; value: string }[],
): Promise<Response> {
  const tab = await getCurrentTab();
  if (!tab?.id) return errorResponse('No active tab found');

  const result = await sendToContentScript<{ success: number; failure: number }>(
    tab.id,
    { type: 'fill', items: matches },
  );

  return { ok: true, type: 'fill', success: result.success, failure: result.failure };
}
