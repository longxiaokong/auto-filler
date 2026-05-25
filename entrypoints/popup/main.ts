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

type ViewState = 'idle' | 'scanning' | 'result' | 'filling' | 'filled';

interface DisplayItem {
  index: number;
  label: string;
  value: string;
  status: 'matched' | 'pending' | 'unmatched';
  checked: boolean;
}

// State
let viewState: ViewState = 'idle';
let displayItems: DisplayItem[] = [];
let fields: FormFieldInfo[] = [];

async function init() {
  const [hasFields, apiReady] = await Promise.all([
    hasTextFields(),
    isApiConfigured(),
  ]);

  renderHeader(profileType);

  if (!profileReady || !apiReady) {
    renderNotConfigured(!profileReady);
    return;
  }

  renderIdle();
}

function renderHeader() {
  const header = document.createElement('div');
  header.className = 'header';
  header.innerHTML = `
    <div class="header-left">
      <div class="logo-icon">AI</div>
      <span class="logo-text">智能填表助手</span>
    </div>
    <div class="header-right">
      <button class="avatar-btn" id="avatarBtn" title="工作台">${PROFILE_TYPE_LABELS[profileType]?.[0] || '用'}</button>
      <button class="close-btn" id="closeBtn" title="关闭">&times;</button>
    </div>
  `;
  app.appendChild(header);

  document.getElementById('avatarBtn')!.addEventListener('click', () => {
    const extId = chrome.runtime.id;
    window.open(`http://localhost:5173?extId=${extId}`);
  });
  document.getElementById('closeBtn')!.addEventListener('click', () => {
    window.close();
  });
}

function getMainContainer(needFooter: boolean): HTMLElement {
  let main = app.querySelector<HTMLElement>('.main');
  if (!main) {
    main = document.createElement('div');
    main.className = 'main';
    app.appendChild(main);
  }
  main.className = needFooter ? 'main has-footer' : 'main no-footer';
  main.innerHTML = '';
  return main;
}

function renderNotConfigured(needProfile: boolean) {
  const main = getMainContainer(false);
  main.innerHTML = `
    <div class="not-configured">
      <div class="icon">⚙️</div>
      <p>${needProfile ? '请先在设置页录入个人信息' : '请先在设置页配置 API Key'}</p>
      <span class="settings-link" id="goSettings">前往设置</span>
    </div>
  `;
  document.getElementById('goSettings')!.addEventListener('click', () => {
    const extId = chrome.runtime.id;
    window.open(`http://localhost:5173?extId=${extId}`);
  });
}

function renderIdle() {
  viewState = 'idle';
  removeFooter();
  const main = getMainContainer(false);
  main.innerHTML = `
    <div class="scan-card">
      <div class="scan-icon-wrap">🔍</div>
      <div class="scan-title">扫描当前页面</div>
      <div class="scan-desc">自动识别表单字段并匹配您的个人信息</div>
      <button class="scan-btn" id="scanBtn">开始扫描</button>
    </div>
  `;
  document.getElementById('scanBtn')!.addEventListener('click', startScan);
}

function renderScanning() {
  viewState = 'scanning';
  removeFooter();
  const main = getMainContainer(false);
  main.innerHTML = `
    <div class="loading-wrap">
      <div class="spinner"></div>
      <div class="loading-text">正在识别表单字段...</div>
    </div>
  `;
}

function buildDisplayItems(scanResp: ScanResponse): DisplayItem[] {
  const matchedSet = new Map<number, MatchResult>();
  for (const m of scanResp.matches) {
    matchedSet.set(m.index, m);
  }

  const items: DisplayItem[] = [];

  // Matched items first
  for (const m of scanResp.matches) {
    const field = scanResp.fields.find((f) => f.index === m.index);
    items.push({
      index: m.index,
      label: getFieldLabel(field, m.index),
      value: m.value,
      status: 'matched',
      checked: true,
    });
  }

  // Unmatched fields
  for (const f of scanResp.fields) {
    if (!matchedSet.has(f.index)) {
      items.push({
        index: f.index,
        label: getFieldLabel(f, f.index),
        value: '-',
        status: 'unmatched',
        checked: false,
      });
    }
  }

  return items;
}

function getFieldLabel(field: FormFieldInfo | undefined, index: number): string {
  if (!field) return `字段 #${index}`;
  return field.label || field.placeholder || field.name || field.ariaLabel || `字段 #${index}`;
}

function renderResult(scanResp: ScanResponse) {
  viewState = 'result';
  fields = scanResp.fields;
  displayItems = buildDisplayItems(scanResp);

  const pendingCount = displayItems.filter((i) => i.status === 'pending').length;
  const matchedCount = displayItems.filter((i) => i.status === 'matched').length;

  const main = getMainContainer(true);

  if (scanResp.total === 0) {
    main.innerHTML = `
      <div class="result-msg">
        <div class="icon empty">📭</div>
        <div class="text">未检测到表单字段</div>
        <div class="sub">当前页面无可填充的输入框</div>
      </div>
    `;
    renderFooter(0);
    return;
  }

  main.innerHTML = `
    <div class="stats-bar">
      <div class="stat-item">
        <div class="stat-value">${scanResp.total}</div>
        <div class="stat-label">识别字段</div>
      </div>
      <div class="stat-item">
        <div class="stat-value matched">${matchedCount}</div>
        <div class="stat-label">匹配成功</div>
      </div>
      <div class="stat-item">
        <div class="stat-value pending">${pendingCount}</div>
        <div class="stat-label">待确认</div>
      </div>
    </div>
    <div class="field-list-card">
      <div class="field-list-header">
        <span class="col-label">字段</span>
        <span class="col-value">匹配内容</span>
        <span class="col-status">状态</span>
      </div>
      <ul class="field-list" id="fieldList"></ul>
    </div>
  `;

  const list = document.getElementById('fieldList')!;
  for (const item of displayItems) {
    const li = document.createElement('li');
    li.className = 'field-item' + (item.status === 'pending' ? ' pending-row' : '');

    const checkboxHtml = item.status !== 'unmatched'
      ? `<input type="checkbox" data-idx="${item.index}" ${item.checked ? 'checked' : ''} />`
      : `<input type="checkbox" data-idx="${item.index}" disabled />`;

    const statusHtml =
      item.status === 'matched'
        ? '<span class="status-tag matched">已匹配</span>'
        : item.status === 'pending'
          ? '<span class="status-tag pending">需确认</span>'
          : '<span class="status-tag unmatched">未匹配</span>';

    li.innerHTML = `
      ${checkboxHtml}
      <span class="field-label" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span>
      <span class="field-value" title="${escapeHtml(item.value)}">${escapeHtml(item.value)}</span>
      <span class="field-status">${statusHtml}</span>
    `;
    list.appendChild(li);
  }

  // Bind checkbox events
  list.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:not([disabled])').forEach((cb) => {
    cb.addEventListener('change', () => {
      const idx = Number(cb.dataset.idx);
      const item = displayItems.find((i) => i.index === idx);
      if (item) item.checked = cb.checked;
      updateFooterButton();
    });
  });

  renderFooter(matchedCount);
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function removeFooter() {
  const footer = app.querySelector<HTMLElement>('.footer');
  if (footer) footer.remove();
}

function renderFooter(matchedCount: number) {
  removeFooter();
  const footer = document.createElement('div');
  footer.className = 'footer';
  footer.innerHTML = `
    <button class="fill-btn" id="fillBtn">一键自动填充（${matchedCount} 项）</button>
    <button class="secondary-btn" id="rescanBtn">重新扫描</button>
  `;
  app.appendChild(footer);

  const fillBtn = document.getElementById('fillBtn') as HTMLButtonElement;
  fillBtn.disabled = matchedCount === 0;
  fillBtn.addEventListener('click', startFill);

  document.getElementById('rescanBtn')!.addEventListener('click', startScan);
}

function updateFooterButton() {
  const checkedCount = displayItems.filter((i) => i.checked && i.status !== 'unmatched').length;
  const fillBtn = document.getElementById('fillBtn') as HTMLButtonElement | null;
  if (fillBtn) {
    fillBtn.textContent = `一键自动填充（${checkedCount} 项）`;
    fillBtn.disabled = checkedCount === 0;
  }
}

function startScan() {
  renderScanning();

  chrome.runtime.sendMessage({ type: 'startScan' }, (response: ScanResponse | ErrorResponse) => {
    if (chrome.runtime.lastError) {
      showError('无法连接到页面，请刷新后重试');
      return;
    }
    if (!response?.ok) {
      showError((response as ErrorResponse).error);
      return;
    }
    const scanResp = response as ScanResponse;
    renderResult(scanResp);
  });
}

function showError(message: string) {
  viewState = 'idle';
  removeFooter();
  const main = getMainContainer(false);
  main.innerHTML = `
    <div class="result-msg">
      <div class="icon error">✕</div>
      <div class="text">扫描失败</div>
      <div class="sub">${escapeHtml(message)}</div>
    </div>
  `;

  const btn = document.createElement('button');
  btn.className = 'scan-btn';
  btn.style.marginTop = '20px';
  btn.style.maxWidth = '200px';
  btn.textContent = '重新扫描';
  btn.addEventListener('click', startScan);
  main.querySelector('.result-msg')!.appendChild(btn);
}

function startFill() {
  const selected = displayItems
    .filter((i) => i.checked && i.status !== 'unmatched')
    .map((i) => ({ index: i.index, value: i.value }));

  if (selected.length === 0) return;

  viewState = 'filling';
  removeFooter();
  const main = getMainContainer(false);
  main.innerHTML = `
    <div class="loading-wrap">
      <div class="spinner"></div>
      <div class="loading-text">正在填充表单...</div>
    </div>
  `;

  chrome.runtime.sendMessage(
    { type: 'startFill', payload: { matches: selected } },
    (response: FillResponse | ErrorResponse) => {
      if (!response?.ok) {
        renderFillResult(false, 0, 0, (response as ErrorResponse).error);
        return;
      }
      const fillResp = response as FillResponse;
      renderFillResult(fillResp.failure === 0, fillResp.success, fillResp.failure);
    },
  );
}

function renderFillResult(success: boolean, successCount: number, failureCount: number, errorMsg?: string) {
  viewState = 'filled';
  removeFooter();
  const main = getMainContainer(false);

  if (!success && errorMsg) {
    main.innerHTML = `
      <div class="result-msg">
        <div class="icon error">✕</div>
        <div class="text">填充失败</div>
        <div class="sub">${escapeHtml(errorMsg)}</div>
      </div>
    `;
  } else if (failureCount === 0) {
    main.innerHTML = `
      <div class="result-msg">
        <div class="icon success">✓</div>
        <div class="text">填充完成</div>
        <div class="sub">成功填充 ${successCount} 个字段</div>
      </div>
    `;
  } else {
    main.innerHTML = `
      <div class="result-msg">
        <div class="icon success">✓</div>
        <div class="text">填充完成</div>
        <div class="sub">成功 ${successCount} 个，失败 ${failureCount} 个</div>
      </div>
    `;
  }

  const btn = document.createElement('button');
  btn.className = 'scan-btn';
  btn.style.marginTop = '20px';
  btn.style.maxWidth = '200px';
  btn.textContent = '关闭';
  btn.addEventListener('click', () => window.close());
  main.querySelector('.result-msg')!.appendChild(btn);
}

init();
