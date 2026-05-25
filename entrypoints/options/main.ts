import { getApiConfig, setApiConfig } from '../../utils/storage';
import { getAllTextFields, saveAllTextFields, getAllBlockCategories, saveBlockCategory, deleteBlockCategory } from '../../utils/db';
import type { TextField, BlockCategory, BlockItem } from '../../utils/db';
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
let blockCategories: BlockCategory[] = [];
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

  // Block categories (dynamic from IndexedDB)
  const blocksHtml = blockCategories.map((cat) => {
    const catId = cat.id!;
    const itemsHtml = cat.items.map((item, itemIdx) => renderBlockItemHtml(item, catId, itemIdx)).join('');
    const emptyHtml = cat.items.length === 0 ? '<div class="block-empty">暂无内容，点击下方按钮添加</div>' : '';
    return `
      <div class="card">
        <div class="card-header">
          <span class="card-title">${escapeHtml(cat.title)}</span>
          <button class="card-action block-delete-btn" data-cat-id="${catId}" title="删除此分类">删除分类</button>
        </div>
        <div class="exp-list">${itemsHtml}${emptyHtml}</div>
        <button class="add-btn block-add-item-btn" data-cat-id="${catId}">+ 添加条目</button>
      </div>
    `;
  }).join('');

  // Add block category button
  const addBlockHtml = `
    <button class="add-btn add-block-cat-btn" style="margin-bottom: 20px;">+ 添加分类</button>
  `;

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

        ${addBlockHtml}
        ${blocksHtml}
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

  bindBlockEvents();
}

// ===== Block Item Rendering =====

function renderBlockItemHtml(item: BlockItem, catId: number, itemIdx: number): string {
  const first = item.fields[0];
  const keyLabel = first ? escapeHtml(first.key) : '';
  const valueDisplay = first ? escapeHtml(first.value) || '<span class="empty">未填写</span>' : '<span class="empty">未填写</span>';
  const metaHtml = item.fields.slice(1).map(f =>
    `<span class="exp-card-meta-item">${escapeHtml(f.key)}: ${escapeHtml(f.value)}</span>`
  ).join('');

  return `
    <div class="exp-card" data-cat-id="${catId}" data-item-idx="${itemIdx}">
      <div class="exp-card-header">
        <div>
          ${keyLabel ? `<div class="exp-card-key">${keyLabel}</div>` : ''}
          <span class="exp-card-title">${valueDisplay}</span>
        </div>
        <div class="exp-card-actions">
          <button class="block-item-edit-btn" data-cat-id="${catId}" data-item-idx="${itemIdx}">编辑</button>
          <button class="block-item-delete-btn" data-cat-id="${catId}" data-item-idx="${itemIdx}">删除</button>
        </div>
      </div>
      <div class="exp-card-meta">${metaHtml}</div>
    </div>
  `;
}

function renderBlockItemEditHtml(item: BlockItem, catId: number, itemIdx: number): string {
  const rows = item.fields.length === 0
    ? [{ key: '', value: '' }]
    : item.fields;

  const fieldRowsHtml = rows.map(f =>
    `<div class="block-field-row">
      <input type="text" class="block-field-key" placeholder="字段名" value="${escapeHtml(f.key)}" />
      <input type="text" class="block-field-value" placeholder="字段值" value="${escapeHtml(f.value)}" />
      <button class="btn-delete block-field-remove-btn" title="删除字段">&times;</button>
    </div>`
  ).join('');

  return `
    <div class="exp-card block-item-edit" data-cat-id="${catId}" data-item-idx="${itemIdx}">
      <div class="block-edit-fields">${fieldRowsHtml}</div>
      <div class="block-edit-actions">
        <button class="add-btn block-add-field-btn">+ 添加字段</button>
        <button class="card-action block-edit-save-btn">保存</button>
        <button class="card-action block-edit-cancel-btn">取消</button>
      </div>
    </div>
  `;
}

async function bindBlockEvents() {
  // Add new block category — inline input
  document.querySelector('.add-block-cat-btn')?.addEventListener('click', () => {
    const btn = document.querySelector('.add-block-cat-btn')!;
    const wrapper = document.createElement('div');
    wrapper.className = 'add-block-cat-form';
    wrapper.innerHTML = `
      <input type="text" class="add-block-cat-input" placeholder="输入分类名称，如：项目经历" />
      <button class="card-action add-block-cat-confirm">添加</button>
      <button class="add-block-cat-cancel">取消</button>
    `;
    btn.replaceWith(wrapper);
    const input = wrapper.querySelector<HTMLInputElement>('.add-block-cat-input')!;
    input.focus();

    async function doAdd() {
      const title = input.value.trim();
      if (!title) { wrapper.replaceWith(btn); return; }
      const cat: BlockCategory = { title, items: [] };
      const id = await saveBlockCategory(cat);
      cat.id = id;
      blockCategories.push(cat);
      renderProfilePage();
    }

    function doCancel() {
      wrapper.replaceWith(btn);
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doAdd();
      if (e.key === 'Escape') doCancel();
    });
    wrapper.querySelector('.add-block-cat-confirm')!.addEventListener('click', doAdd);
    wrapper.querySelector('.add-block-cat-cancel')!.addEventListener('click', doCancel);
  });

  // Delete block category — inline confirm
  document.querySelectorAll<HTMLButtonElement>('.block-delete-btn').forEach(btn => {
    let confirmTimer: ReturnType<typeof setTimeout> | null = null;

    btn.addEventListener('click', async () => {
      if (btn.dataset.confirming === 'true') {
        // Second click — actually delete
        if (confirmTimer) clearTimeout(confirmTimer);
        const catId = Number(btn.dataset.catId);
        await deleteBlockCategory(catId);
        blockCategories = blockCategories.filter(c => c.id !== catId);
        renderProfilePage();
        return;
      }
      // First click — enter confirm state
      btn.dataset.confirming = 'true';
      btn.textContent = '确认删除？';
      confirmTimer = setTimeout(() => {
        btn.dataset.confirming = '';
        btn.textContent = '删除分类';
      }, 3000);
    });
  });

  // Add new item to a block category
  document.querySelectorAll<HTMLButtonElement>('.block-add-item-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const catId = Number(btn.dataset.catId);
      const cat = blockCategories.find(c => c.id === catId);
      if (!cat) return;
      const newItem: BlockItem = { fields: [{ key: '', value: '' }] };
      cat.items.push(newItem);
      renderProfilePage();
      const editCards = document.querySelectorAll<HTMLElement>('.block-item-edit');
      const last = editCards[editCards.length - 1];
      last?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      last?.querySelector<HTMLInputElement>('.block-field-key')?.focus();
    });
  });

  // Edit item
  document.querySelectorAll<HTMLButtonElement>('.block-item-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const catId = Number(btn.dataset.catId);
      const itemIdx = Number(btn.dataset.itemIdx);
      const cat = blockCategories.find(c => c.id === catId);
      if (!cat) return;
      const item = cat.items[itemIdx];
      const displayCard = btn.closest('.exp-card')!;
      const tmp = document.createElement('div');
      tmp.innerHTML = renderBlockItemEditHtml(item, catId, itemIdx);
      const editCard = tmp.firstElementChild as HTMLElement;
      displayCard.replaceWith(editCard);
      bindBlockItemEditEvents(editCard, catId, itemIdx);
    });
  });

  // Delete item — inline confirm
  document.querySelectorAll<HTMLButtonElement>('.block-item-delete-btn').forEach(btn => {
    let confirmTimer: ReturnType<typeof setTimeout> | null = null;

    btn.addEventListener('click', async () => {
      if (btn.dataset.confirming === 'true') {
        if (confirmTimer) clearTimeout(confirmTimer);
        const catId = Number(btn.dataset.catId);
        const itemIdx = Number(btn.dataset.itemIdx);
        const cat = blockCategories.find(c => c.id === catId);
        if (!cat) return;
        cat.items.splice(itemIdx, 1);
        await saveBlockCategory(cat);
        renderProfilePage();
        return;
      }
      btn.dataset.confirming = 'true';
      btn.textContent = '确认？';
      confirmTimer = setTimeout(() => {
        btn.dataset.confirming = '';
        btn.textContent = '删除';
      }, 3000);
    });
  });
}

function bindBlockItemEditEvents(editCard: HTMLElement, catId: number, itemIdx: number) {
  // Add field row
  editCard.querySelector('.block-add-field-btn')?.addEventListener('click', () => {
    const fieldsContainer = editCard.querySelector('.block-edit-fields')!;
    const row = document.createElement('div');
    row.className = 'block-field-row';
    row.innerHTML = `
      <input type="text" class="block-field-key" placeholder="字段名" value="" />
      <input type="text" class="block-field-value" placeholder="字段值" value="" />
      <button class="btn-delete block-field-remove-btn" title="删除字段">&times;</button>
    `;
    fieldsContainer.appendChild(row);
    row.querySelector<HTMLInputElement>('.block-field-key')?.focus();
    row.querySelector('.block-field-remove-btn')?.addEventListener('click', () => row.remove());
  });

  // Remove field row
  editCard.querySelectorAll('.block-field-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.block-field-row')!;
      const container = editCard.querySelector('.block-edit-fields')!;
      if (container.children.length > 1) {
        row.remove();
      }
    });
  });

  // Save
  editCard.querySelector('.block-edit-save-btn')?.addEventListener('click', async () => {
    const cat = blockCategories.find(c => c.id === catId);
    if (!cat) return;
    const rows = editCard.querySelectorAll<HTMLElement>('.block-field-row');
    const fields: { key: string; value: string }[] = [];
    rows.forEach(row => {
      const key = (row.querySelector('.block-field-key') as HTMLInputElement)?.value.trim() ?? '';
      const value = (row.querySelector('.block-field-value') as HTMLInputElement)?.value.trim() ?? '';
      if (key || value) fields.push({ key, value });
    });
    cat.items[itemIdx] = { fields };
    await saveBlockCategory(cat);
    renderProfilePage();
  });

  // Cancel
  editCard.querySelector('.block-edit-cancel-btn')?.addEventListener('click', () => {
    const cat = blockCategories.find(c => c.id === catId);
    if (!cat) return;
    // If item has no meaningful fields, remove it
    const item = cat.items[itemIdx];
    const hasContent = item.fields.some(f => f.key.trim() || f.value.trim());
    if (!hasContent) {
      cat.items.splice(itemIdx, 1);
    }
    renderProfilePage();
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
  const [fields, apiConfig, blocks] = await Promise.all([
    getAllTextFields(),
    getApiConfig(),
    getAllBlockCategories(),
  ]);

  textFields = fields;
  apiConfigData = apiConfig;
  blockCategories = blocks;

  switchPage('profile');
}

init();
