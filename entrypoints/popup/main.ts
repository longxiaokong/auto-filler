import './style.css';
import { isApiConfigured } from '@/utils/storage';
import { hasTextFields } from '@/utils/db';
import type { MatchResult, FormFieldInfo } from '@/utils/matcher';

const app = document.getElementById('app')!;

interface ScanResponse {
  ok: true;
  type: 'scan';
  total: number;
  matched: number;
  matches: MatchResult[];
  fields: FormFieldInfo[];
}

interface ErrorResponse {
  ok: false;
  error: string;
}

interface FillResponse {
  ok: true;
  type: 'fill';
  success: number;
  failure: number;
}

let matches: MatchResult[] = [];
let fields: FormFieldInfo[] = [];
let selectedIndices = new Set<number>();

async function init() {
  const [hasFields, apiReady] = await Promise.all([
    hasTextFields(),
    isApiConfigured(),
  ]);

  renderHeader();
  renderMain(hasFields, apiReady);
}

function renderHeader() {
  const header = document.createElement('div');
  header.className = 'header';
  header.innerHTML = `
    <div class="header-left">
      <span class="logo">Auto Filler</span>
    </div>
    <div class="header-right">
      <button class="settings-btn" id="settingsBtn" title="设置">⚙</button>
    </div>
  `;
  app.appendChild(header);

  document.getElementById('settingsBtn')!.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

function renderMain(hasFields: boolean, apiReady: boolean) {
  const main = document.createElement('div');
  main.className = 'main';

  if (!hasFields || !apiReady) {
    main.innerHTML = `
      <div class="not-configured">
        <p>${!hasFields ? '请先在设置页录入个人信息' : '请先在设置页配置 API Key'}</p>
        <span class="settings-link" id="goSettings">前往设置</span>
      </div>
    `;
    app.appendChild(main);
    document.getElementById('goSettings')!.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
    return;
  }

  const btn = document.createElement('button');
  btn.className = 'scan-btn';
  btn.textContent = '扫描当前页面';
  btn.addEventListener('click', startScan);
  main.appendChild(btn);
  app.appendChild(main);
}

function startScan() {
  const main = app.querySelector<HTMLElement>('.main')!;
  main.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <div class="loading-text">正在扫描并匹配字段...</div>
    </div>
  `;

  chrome.runtime.sendMessage({ type: 'startScan' }, (response: ScanResponse | ErrorResponse) => {
    if (chrome.runtime.lastError) {
      showError(main, '无法连接到页面，请刷新后重试');
      return;
    }
    if (!response?.ok) {
      showError(main, (response as ErrorResponse).error);
      return;
    }
    const scanResp = response as ScanResponse;
    matches = scanResp.matches;
    fields = scanResp.fields;
    selectedIndices = new Set(matches.map((m) => m.index));
    renderResult(main, scanResp);
  });
}

function showError(main: HTMLElement, message: string) {
  main.innerHTML = `
    <div class="error">
      <div class="error-text">${message}</div>
      <button class="scan-btn" id="retryBtn">重新扫描</button>
    </div>
  `;
  document.getElementById('retryBtn')!.addEventListener('click', startScan);
}

function renderResult(main: HTMLElement, scanResp: ScanResponse) {
  if (scanResp.total === 0) {
    main.innerHTML = `
      <div class="empty-result">未检测到可填充的表单字段</div>
    `;
    return;
  }

  main.innerHTML = `
    <div class="result-header">识别到 ${scanResp.total} 个表单字段（匹配 ${scanResp.matched} 个）</div>
    <ul class="field-list" id="fieldList"></ul>
    <button class="fill-btn" id="fillBtn">确认填充</button>
  `;

  const list = document.getElementById('fieldList')!;

  for (const match of matches) {
    const li = document.createElement('li');
    li.className = 'field-item';

    const label = getFieldLabel(match.index);
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selectedIndices.add(match.index);
      else selectedIndices.delete(match.index);
    });

    li.appendChild(checkbox);
    li.innerHTML += `
      <span class="field-label">${label}</span>
      <span class="field-arrow">→</span>
      <span class="field-value">${match.value}</span>
    `;
    li.prepend(checkbox);
    list.appendChild(li);
  }

  document.getElementById('fillBtn')!.addEventListener('click', startFill);
}

function getFieldLabel(index: number): string {
  const field = fields.find((f) => f.index === index);
  if (!field) return `字段 #${index}`;
  return field.label || field.placeholder || field.name || field.ariaLabel || `字段 #${index}`;
}

function startFill() {
  const selected = matches.filter((m) => selectedIndices.has(m.index));
  if (selected.length === 0) return;

  const main = app.querySelector<HTMLElement>('.main')!;
  main.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <div class="loading-text">正在填充...</div>
    </div>
  `;

  const items = selected.map((m) => ({ index: m.index, value: m.value }));

  chrome.runtime.sendMessage({ type: 'startFill', payload: { matches: items } }, (response: FillResponse | ErrorResponse) => {
    if (!response?.ok) {
      showError(main, (response as ErrorResponse).error);
      return;
    }
    const fillResp = response as FillResponse;
    const cls = fillResp.failure === 0 ? 'success' : 'partial';
    const text = fillResp.failure === 0
      ? `填充完成！成功 ${fillResp.success} 个字段`
      : `填充完成：成功 ${fillResp.success} 个，失败 ${fillResp.failure} 个`;
    main.innerHTML = `
      <div class="fill-result ${cls}">${text}</div>
    `;
  });
}

init();
