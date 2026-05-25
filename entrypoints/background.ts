import { getProfile, getApiConfig, isProfileConfigured, isApiConfigured } from '@/utils/storage';
import { matchFields } from '@/utils/matcher';
import type { MatchResult } from '@/utils/matcher';
import type { FormFieldInfo } from '@/utils/matcher';

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
  return chrome.tabs.sendMessage(tabId, message) as Promise<T>;
}

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((request: Request<MessageType>, _sender, sendResponse) => {
    handleMessage(request)
      .then(sendResponse)
      .catch((err) => sendResponse(errorResponse(err.message)));

    return true; // keep channel open for async
  });
});

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

  const [profileReady, apiReady] = await Promise.all([
    isProfileConfigured(),
    isApiConfigured(),
  ]);

  if (!profileReady) return errorResponse('请先在设置页录入个人信息');
  if (!apiReady) return errorResponse('请先在设置页配置 API Key');

  // 1. Ask content script to scan fields
  const scanResults = await sendToContentScript<
    Array<{ index: number; field: FormFieldInfo }>
  >(tab.id, { type: 'scan' });

  if (!scanResults || scanResults.length === 0) {
    return { ok: true, type: 'scan', total: 0, matched: 0, matches: [], fields: [] };
  }

  const fieldInfos = scanResults.map((r) => r.field);

  // 2. Run LLM matching
  const { profileType, fields: profileFields } = await getProfile();
  const apiConfig = await getApiConfig();

  const matches = await matchFields(fieldInfos, apiConfig, profileType, profileFields);

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
