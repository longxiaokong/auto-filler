import { getApiConfig, setApiConfig } from '../../utils/storage';
import { getAllTextFields, saveAllTextFields } from '../../utils/db';
import type { TextField } from '../../utils/db';
import { PROVIDER_PRESETS, getProviderById, type ProviderPreset } from '../../utils/providers';

const navItems = document.querySelectorAll<HTMLElement>('.nav-item');
const pageContent = document.getElementById('pageContent')!;
const pageTitle = document.getElementById('pageTitle')!;
const pageSubtitle = document.getElementById('pageSubtitle')!;

const PAGE_CONFIG: Record<string, { title: string; subtitle: string }> = {
  home: { title: '首页', subtitle: '概览与快捷入口' },
  profile: { title: '个人信息与材料管理', subtitle: '完善个人信息与材料库，提升填表效率与准确性' },
  certificates: { title: '证书材料', subtitle: '管理与维护您的证书和证明材料' },
  autofill: { title: '自动填表', subtitle: '配置自动填表规则与历史记录' },
  docfill: { title: '上传文档智能填充', subtitle: '支持上传 Word / PDF 文档，系统会自动识别字段并匹配信息' },
  pdf: { title: '按顺序生成 PDF', subtitle: '将证明材料按指定顺序排列，生成完整申请材料 PDF' },
  settings: { title: '设置', subtitle: '个人信息、API 配置与账户设置' },
};

let currentPage = 'profile';
let textFields: TextField[] = [];
let apiConfigData: { baseUrl: string; apiKey: string; model: string; providerId: string } | null = null;
let nextFieldId = 0;

// ===== Navigation =====
navItems.forEach((item) => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const page = item.dataset.page!;
    switchPage(page);
  });
});

function switchPage(page: string) {
  currentPage = page;
  navItems.forEach((item) => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  const config = PAGE_CONFIG[page];
  pageTitle.textContent = config.title;
  pageSubtitle.textContent = config.subtitle;

  if (page === 'profile') {
    renderProfilePage();
  } else if (page === 'settings') {
    renderSettingsPage();
  } else {
    renderPlaceholderPage(config.title);
  }
}

function renderPlaceholderPage(title: string) {
  pageContent.innerHTML = `
    <div class="placeholder-page">
      <div class="icon">🚧</div>
      <h2>${title}</h2>
      <p>该功能正在开发中，敬请期待</p>
    </div>
  `;
}

// ===== Profile Page =====
function renderProfilePage() {
  const fieldMap = Object.fromEntries(textFields.map((f) => [f.key, f.value]));

  const infoFields = [
    { key: 'name', label: '姓名' },
    { key: 'phone', label: '手机号' },
    { key: 'email', label: '邮箱' },
    { key: 'school', label: '学校' },
    { key: 'major', label: '专业' },
    { key: 'gpa', label: '学分绩' },
  ];

  const infoHtml = infoFields.map((f) => {
    const val = fieldMap[f.key] ?? '';
    const displayVal = val ? escapeHtml(val) : '<span class="empty">未填写</span>';
    return `
      <div class="profile-field">
        <span class="label">${f.label}</span>
        <span class="value ${val ? '' : 'empty'}">${displayVal}</span>
      </div>
    `;
  }).join('');

  // Mock experiences
  const experiences = [
    { name: '校园二手交易平台', time: '2024.03 - 2024.06', desc: '基于 Vue + Node.js 的全栈项目，支持商品发布、即时聊天与支付功能', type: '团队' },
    { name: '智能简历分析系统', time: '2023.09 - 2023.12', desc: '使用 NLP 技术解析简历内容，自动提取关键信息并生成结构化报告', type: '个人' },
  ];

  const expHtml = experiences.map((e) => `
    <div class="exp-card">
      <div class="exp-card-header">
        <span class="exp-card-title">${escapeHtml(e.name)}</span>
        <span class="exp-tag">${e.type}</span>
      </div>
      <div class="exp-card-meta">${escapeHtml(e.time)}</div>
      <div class="exp-card-desc">${escapeHtml(e.desc)}</div>
    </div>
  `).join('');

  // Mock awards
  const awards = [
    { name: '全国大学生数学建模竞赛 省级一等奖', time: '2024.10', org: '中国工业与应用数学学会' },
    { name: 'ACM-ICPC 区域赛 银奖', time: '2023.11', org: 'ACM 协会' },
  ];

  const awardHtml = awards.map((a) => `
    <div class="award-item">
      <div class="award-icon">🏆</div>
      <div class="award-info">
        <div class="award-name">${escapeHtml(a.name)}</div>
        <div class="award-meta">${escapeHtml(a.time)} · ${escapeHtml(a.org)}</div>
      </div>
    </div>
  `).join('');

  // Mock materials
  const materials = [
    { name: '身份证正反面', status: '可调用', icon: '🆔' },
    { name: '学生证', status: '可调用', icon: '🎓' },
    { name: '一寸证件照', status: '可调用', icon: '📷' },
    { name: '成绩单 PDF', status: '可调用', icon: '📄' },
  ];

  const materialHtml = materials.map((m) => `
    <div class="material-item">
      <div class="material-thumb">${m.icon}</div>
      <div class="material-info">
        <div class="material-name">${escapeHtml(m.name)}</div>
        <span class="material-status">${m.status}</span>
      </div>
      <div class="material-actions">
        <button>替换</button>
        <button>设为常用</button>
        <button class="delete">删除</button>
      </div>
    </div>
  `).join('');

  const firstName = fieldMap['name']?.[0] || '用';

  pageContent.innerHTML = `
    <div class="profile-grid">
      <div class="profile-left">
        <div class="card">
          <div class="card-header">
            <span class="card-title">个人信息</span>
            <button class="card-action" id="editProfileBtn">编辑</button>
          </div>
          <div class="profile-info">
            <div class="profile-avatar">${firstName}</div>
            <div class="profile-fields">${infoHtml}</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title">项目经历</span>
          </div>
          <div class="exp-list">${expHtml}</div>
          <button class="add-btn">+ 添加项目</button>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title">竞赛获奖</span>
          </div>
          <div>${awardHtml}</div>
          <button class="add-btn">+ 添加奖项</button>
        </div>
      </div>

      <div class="profile-right">
        <div class="card">
          <div class="material-header">
            <div>
              <div class="card-title">材料库</div>
              <div class="material-count">共 ${materials.length} 个材料</div>
            </div>
            <button class="upload-btn">上传材料</button>
          </div>
          <div class="material-list">${materialHtml}</div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('editProfileBtn')?.addEventListener('click', () => {
    switchPage('settings');
  });
}

// ===== Settings Page =====
function renderSettingsPage() {
  const fieldMap = Object.fromEntries(textFields.map((f) => [f.key, f.value]));
  const api = apiConfigData ?? { baseUrl: '', apiKey: '', model: '', providerId: '' };

  nextFieldId = 0;
  const fieldRowsHtml = textFields.map((f) => createFieldRowHtml(f.key, f.value)).join('');

  pageContent.innerHTML = `
    <div class="settings-form">
      <div class="settings-section">
        <h2>个人信息</h2>
        <div id="fieldList">${fieldRowsHtml}</div>
        <button class="add-btn" id="addFieldBtn">+ 添加字段</button>
      </div>

      <div class="settings-section">
        <h2>API 配置</h2>
        <div class="form-group">
          <label for="providerSelect">模型供应商</label>
          <select id="providerSelect">
            <option value="">自定义</option>
            ${buildProviderOptions(api.providerId)}
          </select>
        </div>
        <div class="form-group">
          <label for="baseUrl">Base URL</label>
          <input type="text" id="baseUrl" value="${escapeAttr(api.baseUrl)}" placeholder="https://api.openai.com/v1" />
        </div>
        <div class="form-group">
          <label for="apiKey">API Key</label>
          <input type="password" id="apiKey" value="${escapeAttr(api.apiKey)}" placeholder="请输入 API Key" />
          <span class="api-key-hint" id="apiKeyHint"></span>
        </div>
        <div class="form-group">
          <label for="modelSelect">模型</label>
          <select id="modelSelect">
            ${buildModelOptions(api.providerId, api.model)}
          </select>
          <input type="text" id="modelCustom" class="hidden" placeholder="输入自定义模型名称" />
        </div>
      </div>

      <div class="settings-actions">
        <button id="saveBtn" class="save-btn">保存</button>
        <span id="statusMsg" class="status-msg"></span>
      </div>
    </div>
  `;

  document.getElementById('addFieldBtn')?.addEventListener('click', () => {
    const list = document.getElementById('fieldList')!;
    const row = createFieldRowEl('', '');
    list.appendChild(row);
    row.querySelector<HTMLInputElement>('.field-key')?.focus();
  });

  document.getElementById('providerSelect')?.addEventListener('change', onProviderChange);
  document.getElementById('modelSelect')?.addEventListener('change', onModelSelectChange);

  document.getElementById('saveBtn')?.addEventListener('click', saveSettings);
}

function buildProviderOptions(currentProviderId: string): string {
  const categories = ['domestic', 'aggregator', 'third-party', 'research', 'local'] as const;
  const categoryLabels: Record<string, string> = {
    domestic: '国内厂商',
    aggregator: '聚合平台',
    'third-party': '第三方',
    research: '研究机构',
    local: '本地 / 自部署',
  };

  return categories
    .map((cat) => {
      const providers = PROVIDER_PRESETS.filter((p) => p.category === cat);
      const options = providers
        .map((p) => {
          const sel = p.id === currentProviderId ? ' selected' : '';
          return `<option value="${p.id}"${sel}>${p.name}</option>`;
        })
        .join('');
      return `<optgroup label="${categoryLabels[cat]}">${options}</optgroup>`;
    })
    .join('');
}

function buildModelOptions(providerId: string, currentModel: string): string {
  if (!providerId) {
    const sel = currentModel ? '' : ' selected';
    return `<option value=""${sel}>请先选择供应商</option>${currentModel ? `<option value="${escapeAttr(currentModel)}" selected>${escapeHtml(currentModel)} (当前)</option>` : ''}<option value="__custom__">自定义模型...</option>`;
  }

  const provider = getProviderById(providerId);
  if (!provider || provider.models.length === 0) {
    const sel = currentModel ? '' : ' selected';
    return `<option value=""${sel}>自定义</option><option value="__custom__">自定义模型...</option>${currentModel ? `<option value="${escapeAttr(currentModel)}" selected>${escapeHtml(currentModel)} (当前)</option>` : ''}`;
  }

  const modelInList = provider.models.includes(currentModel);
  const options = provider.models
    .map((m) => {
      const sel = m === currentModel ? ' selected' : '';
      return `<option value="${m}"${sel}>${m}</option>`;
    })
    .join('');

  const customOpt = currentModel && !modelInList
    ? `<option value="${escapeAttr(currentModel)}" selected>${escapeHtml(currentModel)} (当前)</option>`
    : '';

  return `${options}${customOpt}<option value="__custom__">自定义模型...</option>`;
}

function onProviderChange() {
  const select = document.getElementById('providerSelect') as HTMLSelectElement;
  const providerId = select.value;
  const provider = getProviderById(providerId);
  const baseUrlInput = document.getElementById('baseUrl') as HTMLInputElement;
  const modelSelect = document.getElementById('modelSelect') as HTMLSelectElement;
  const modelCustom = document.getElementById('modelCustom') as HTMLInputElement;
  const apiKeyHint = document.getElementById('apiKeyHint');

  if (provider) {
    baseUrlInput.value = provider.baseUrl;
    if (provider.apiKeyUrl && apiKeyHint) {
      apiKeyHint.innerHTML = `获取 Key: <a href="${escapeAttr(provider.apiKeyUrl)}" target="_blank">${escapeHtml(provider.apiKeyUrl)}</a>`;
    } else if (apiKeyHint) {
      apiKeyHint.textContent = '';
    }
  } else {
    if (apiKeyHint) apiKeyHint.textContent = '';
  }

  modelSelect.innerHTML = buildModelOptions(providerId, '');
  modelCustom.classList.add('hidden');
  modelCustom.value = '';
}

function onModelSelectChange() {
  const modelSelect = document.getElementById('modelSelect') as HTMLSelectElement;
  const modelCustom = document.getElementById('modelCustom') as HTMLInputElement;
  if (modelSelect.value === '__custom__') {
    modelCustom.classList.remove('hidden');
    modelCustom.focus();
  } else {
    modelCustom.classList.add('hidden');
  }
}

function createFieldRowHtml(key: string, value: string): string {
  const id = nextFieldId++;
  return `
    <div class="field-row" data-id="${id}">
      <input type="text" class="field-key" placeholder="字段名" value="${escapeHtml(key)}" />
      <input type="text" class="field-value" placeholder="字段值" value="${escapeHtml(value)}" />
      <button class="btn-delete" title="删除">&times;</button>
    </div>
  `;
}

function createFieldRowEl(key: string, value: string): HTMLDivElement {
  const id = nextFieldId++;
  const row = document.createElement('div');
  row.className = 'field-row';
  row.dataset.id = String(id);
  row.innerHTML = `
    <input type="text" class="field-key" placeholder="字段名" value="${escapeHtml(key)}" />
    <input type="text" class="field-value" placeholder="字段值" value="${escapeHtml(value)}" />
    <button class="btn-delete" title="delete">&times;</button>
  `;
  row.querySelector('.btn-delete')!.addEventListener('click', () => row.remove());
  return row;
}

async function saveSettings() {
  const rows = document.querySelectorAll<HTMLElement>('.field-row');
  const fields: { key: string; value: string }[] = [];
  rows.forEach((row) => {
    const key = (row.querySelector('.field-key') as HTMLInputElement)?.value.trim() ?? '';
    const value = (row.querySelector('.field-value') as HTMLInputElement)?.value.trim() ?? '';
    if (key) fields.push({ key, value });
  });

  await saveAllTextFields(fields);
  textFields = fields;

  await setApiConfig({
    baseUrl: (document.getElementById('baseUrl') as HTMLInputElement).value.trim(),
    apiKey: (document.getElementById('apiKey') as HTMLInputElement).value.trim(),
    model: getModelValue(),
    providerId: (document.getElementById('providerSelect') as HTMLSelectElement).value,
  });

  apiConfigData = {
    baseUrl: (document.getElementById('baseUrl') as HTMLInputElement).value.trim(),
    apiKey: (document.getElementById('apiKey') as HTMLInputElement).value.trim(),
    model: getModelValue(),
    providerId: (document.getElementById('providerSelect') as HTMLSelectElement).value,
  };

  showStatus('已保存');
}

function getModelValue(): string {
  const modelSelect = document.getElementById('modelSelect') as HTMLSelectElement;
  if (modelSelect.value === '__custom__') {
    return (document.getElementById('modelCustom') as HTMLInputElement).value.trim();
  }
  return modelSelect.value;
}

function showStatus(text: string) {
  const statusMsg = document.getElementById('statusMsg');
  if (!statusMsg) return;
  statusMsg.textContent = text;
  statusMsg.classList.add('show');
  setTimeout(() => statusMsg.classList.remove('show'), 2000);
}

// ===== Utils =====
function escapeHtml(text: string): string {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ===== Init =====
async function init() {
  const [fields, apiConfig] = await Promise.all([
    getAllTextFields(),
    getApiConfig(),
  ]);

  textFields = fields;
  apiConfigData = apiConfig;

  switchPage('profile');
}

init();
