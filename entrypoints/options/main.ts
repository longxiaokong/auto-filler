import { getApiConfig, setApiConfig } from '../../utils/storage';
import {
  getAllTextFields, saveAllTextFields, getAllBlockCategories, saveBlockCategory, deleteBlockCategory,
  getAllCategories, addCategory, updateCategory, deleteCategory,
  getAllFileRecords, getFileRecordsByCategory, addFileRecord, updateFileRecord, deleteFileRecord,
  moveFileRecordsToCategory, getUncategorizedId,
} from '../../utils/db';
import type { TextField, BlockCategory, BlockItem, Category, FileRecord } from '../../utils/db';
import { PROVIDER_PRESETS, getProviderById, type ProviderPreset } from '../../utils/providers';

const navItems = document.querySelectorAll<HTMLElement>('.nav-item');
const pageContent = document.getElementById('pageContent')!;
const pageTitle = document.getElementById('pageTitle')!;
const pageSubtitle = document.getElementById('pageSubtitle')!;

const DEFAULT_FIELDS: { key: string; label: string }[] = [
  { key: 'name', label: '姓名' },
  { key: 'phone', label: '手机号' },
  { key: 'email', label: '邮箱' },
  { key: 'address', label: '住址' },
];
const DEFAULT_FIELD_KEYS = new Set(DEFAULT_FIELDS.map((f) => f.key));
const DEFAULT_FIELD_LABELS: Record<string, string> = Object.fromEntries(
  DEFAULT_FIELDS.map((f) => [f.key, f.label]),
);

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
let categories: Category[] = [];
let fileRecords: FileRecord[] = [];
let selectedCategoryId: number | null = null;
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
  } else if (page === 'certificates') {
    renderCertificatesPage();
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

  const infoFields = DEFAULT_FIELDS.map((f) => ({ key: f.key, label: f.label }));

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

// ===== Certificates Page =====

const IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const FILE_ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,.doc,.docx';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
}

function getFileCategoryIcon(fileType: string): { cls: string; icon: string } {
  if (fileType === 'application/pdf') return { cls: 'pdf', icon: '📄' };
  if (fileType.includes('word') || fileType.includes('document')) return { cls: 'doc', icon: '📝' };
  return { cls: 'other', icon: '📎' };
}

function renderCertificatesPage() {
  if (categories.length === 0 || selectedCategoryId === null) {
    const unc = categories.find(c => c.isDefault);
    selectedCategoryId = unc?.id ?? null;
  }

  const catHtml = renderCatSidebar();
  const fileHtml = renderCertFilePanel();

  pageContent.innerHTML = `
    <div class="cert-layout">
      <div class="cert-sidebar">
        <div class="cert-sidebar-title">分类管理</div>
        <div class="cert-cat-list">${catHtml}</div>
        <div class="cert-sidebar-footer">
          <button class="cert-add-cat-btn" id="certAddCatBtn">+ 新增分类</button>
        </div>
      </div>
      <div class="cert-main">
        <div class="cert-toolbar">
          <input type="text" class="cert-search" placeholder="搜索文件名..." id="certSearch" />
          <button class="cert-upload-btn" id="certUploadBtn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
            上传材料
          </button>
        </div>
        <div class="cert-file-grid" id="certFileGrid">${fileHtml}</div>
      </div>
    </div>
  `;

  bindCertEvents();
}

function renderCatSidebar(): string {
  return categories.map(cat => {
    const count = fileRecords.filter(f => f.categoryId === cat.id).length;
    const active = cat.id === selectedCategoryId ? ' active' : '';
    const confirmClass = cat._confirmDelete ? ' confirm-delete' : '';
    return `
      <div class="cert-cat-item${active}" data-cat-id="${cat.id}">
        <div class="cert-cat-icon"><img src="${escapeAttr(cat.icon)}" alt="" /></div>
        <div class="cert-cat-info">
          <div class="cert-cat-name" style="${cat._confirmDelete ? 'color:#EF4444' : ''}">${escapeHtml(cat._confirmDelete ? '确认删除？' : cat.name)}</div>
          <div class="cert-cat-count">${count} 个文件</div>
        </div>
        <div class="cert-cat-actions">
          ${!cat.isDefault ? `
            <button class="cert-cat-action-btn rename" title="重命名">✏️</button>
            <button class="cert-cat-action-btn delete${confirmClass}" data-cat-id="${cat.id}" title="删除">${cat._confirmDelete ? '确认' : '🗑️'}</button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderCertFilePanel(): string {
  const catFiles = fileRecords.filter(f => f.categoryId === selectedCategoryId);
  if (catFiles.length === 0) {
    return `
      <div class="cert-empty">
        <div class="cert-empty-icon">📂</div>
        <div class="cert-empty-text">该分类下暂无文件</div>
        <button class="cert-empty-upload-btn" id="certEmptyUpload">上传文件到此分类</button>
      </div>
    `;
  }

  return catFiles.map(f => renderFileCardHtml(f)).join('');
}

function renderFileCardHtml(f: FileRecord): string {
  const isImage = IMAGE_TYPES.has(f.fileType);
  let thumbHtml: string;
  if (isImage) {
    thumbHtml = `<div class="cert-file-thumb"><img src="" data-file-id="${f.id}" alt="${escapeAttr(f.filename)}" /></div>`;
  } else {
    const { cls, icon } = getFileCategoryIcon(f.fileType);
    thumbHtml = `<div class="cert-file-thumb"><span class="cert-file-thumb-icon ${cls}">${icon}</span></div>`;
  }

  const confirmHtml = f._confirmDelete
    ? `<button class="cert-file-action-btn delete confirm-delete" data-file-id="${f.id}">确认?</button>`
    : `<button class="cert-file-action-btn delete" data-file-id="${f.id}" title="删除">🗑️</button>`;

  return `
    <div class="cert-file-card" data-file-id="${f.id}">
      ${thumbHtml}
      <div class="cert-file-info">
        <div class="cert-file-name" title="${escapeAttr(f.filename)}">${escapeHtml(f.filename)}</div>
        <div class="cert-file-size">${formatFileSize(f.fileSize)}</div>
      </div>
      <div class="cert-file-actions">
        <button class="cert-file-action-btn preview" data-file-id="${f.id}" title="预览">👁️</button>
        <button class="cert-file-action-btn move" data-file-id="${f.id}" title="移动">📁</button>
        ${confirmHtml}
      </div>
    </div>
  `;
}

function bindCertEvents() {
  // Load image thumbnails via blob URLs
  const catFiles = fileRecords.filter(f => f.categoryId === selectedCategoryId);
  for (const f of catFiles) {
    if (IMAGE_TYPES.has(f.fileType)) {
      const img = document.querySelector(`img[data-file-id="${f.id}"]`) as HTMLImageElement;
      if (img) {
        const url = URL.createObjectURL(f.fileBody);
        img.src = url;
      }
    }
  }

  // Search
  document.getElementById('certSearch')?.addEventListener('input', (e) => {
    const query = (e.target as HTMLInputElement).value.trim().toLowerCase();
    const grid = document.getElementById('certFileGrid')!;
    const cards = grid.querySelectorAll<HTMLElement>('.cert-file-card');
    cards.forEach(card => {
      const name = card.querySelector('.cert-file-name')?.textContent ?? '';
      card.style.display = (!query || name.toLowerCase().includes(query)) ? '' : 'none';
    });
  });

  // Upload
  const uploadInput = document.createElement('input');
  uploadInput.type = 'file';
  uploadInput.multiple = true;
  uploadInput.accept = FILE_ACCEPT;
  uploadInput.style.display = 'none';
  document.body.appendChild(uploadInput);

  let uploadResolve: ((files: File[]) => void) | null = null;
  uploadInput.addEventListener('change', () => {
    const files = Array.from(uploadInput.files ?? []);
    if (uploadResolve) uploadResolve(files);
    uploadInput.value = '';
  });

  function triggerUpload(): Promise<File[]> {
    return new Promise(resolve => {
      uploadResolve = resolve;
      uploadInput.click();
    });
  }

  async function doUpload(files: File[]) {
    if (files.length === 0 || selectedCategoryId === null) return;
    for (const file of files) {
      await addFileRecord({
        filename: file.name,
        fileType: file.type,
        fileBody: file,
        fileSize: file.size,
        fileDescription: '',
        categoryId: selectedCategoryId,
        createdAt: Date.now(),
      });
    }
    fileRecords = await getAllFileRecords();
    renderCertificatesPage();
    // Scroll to last card
    const grid = document.getElementById('certFileGrid');
    const lastCard = grid?.lastElementChild as HTMLElement;
    lastCard?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  document.getElementById('certUploadBtn')?.addEventListener('click', async () => {
    const files = await triggerUpload();
    await doUpload(files);
  });

  document.getElementById('certEmptyUpload')?.addEventListener('click', async () => {
    const files = await triggerUpload();
    await doUpload(files);
  });

  // Category click
  document.querySelectorAll<HTMLElement>('.cert-cat-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.cert-cat-action-btn')) return;
      const catId = Number(item.dataset.catId);
      selectedCategoryId = catId;
      renderCertificatesPage();
    });
  });

  // Category rename
  document.querySelectorAll<HTMLButtonElement>('.cert-cat-action-btn.rename').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = btn.closest('.cert-cat-item') as HTMLElement;
      const catId = Number(item.dataset.catId);
      const cat = categories.find(c => c.id === catId);
      if (!cat) return;

      const nameEl = item.querySelector('.cert-cat-name')!;
      const original = cat.name;
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'cert-cat-rename-input';
      input.value = original;
      nameEl.replaceWith(input);
      input.focus();
      input.select();

      async function doRename() {
        const newName = input.value.trim();
        if (newName && newName !== original && cat) {
          cat.name = newName;
          await updateCategory(cat);
        }
        renderCertificatesPage();
      }

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doRename();
        if (e.key === 'Escape') renderCertificatesPage();
      });
      input.addEventListener('blur', doRename);
    });
  });

  // Category delete
  document.querySelectorAll<HTMLButtonElement>('.cert-cat-action-btn.delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const catId = Number(btn.dataset.catId);
      const cat = categories.find(c => c.id === catId);
      if (!cat || cat.isDefault) return;

      if (cat._confirmDelete) {
        delete cat._confirmDelete;
        const uncId = await getUncategorizedId();
        await moveFileRecordsToCategory(catId, uncId!);
        await deleteCategory(catId);
        categories = categories.filter(c => c.id !== catId);
        selectedCategoryId = uncId;
        renderCertificatesPage();
      } else {
        cat._confirmDelete = true;
        renderCertificatesPage();
        setTimeout(() => {
          if (cat._confirmDelete) {
            cat._confirmDelete = false;
            renderCertificatesPage();
          }
        }, 3000);
      }
    });
  });

  // Add category
  document.getElementById('certAddCatBtn')?.addEventListener('click', () => {
    const footer = document.querySelector('.cert-sidebar-footer')!;
    const btn = document.getElementById('certAddCatBtn')!;
    const form = document.createElement('div');
    form.className = 'cert-add-cat-form';
    form.innerHTML = `
      <input type="text" placeholder="输入分类名称" />
      <button class="confirm">确定</button>
      <button class="cancel">取消</button>
    `;
    btn.replaceWith(form);
    const input = form.querySelector<HTMLInputElement>('input')!;
    input.focus();

    async function doAdd() {
      const name = input.value.trim();
      if (!name) { renderCertificatesPage(); return; }
      const maxOrder = categories.reduce((m, c) => Math.max(m, c.sortOrder), 0);
      const id = await addCategory({
        name,
        icon: '/icons/folder.svg',
        sortOrder: maxOrder + 1,
        isDefault: false,
      });
      categories.push({ id, name, icon: '/icons/folder.svg', sortOrder: maxOrder + 1, isDefault: false });
      selectedCategoryId = id;
      renderCertificatesPage();
    }

    function doCancel() {
      renderCertificatesPage();
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doAdd();
      if (e.key === 'Escape') doCancel();
    });
    form.querySelector('.confirm')!.addEventListener('click', doAdd);
    form.querySelector('.cancel')!.addEventListener('click', doCancel);
  });

  // File preview
  document.querySelectorAll<HTMLButtonElement>('.cert-file-action-btn.preview').forEach(btn => {
    btn.addEventListener('click', () => {
      const fileId = Number(btn.dataset.fileId);
      const file = fileRecords.find(f => f.id === fileId);
      if (!file) return;
      showPreviewModal(file);
    });
  });

  // File move
  document.querySelectorAll<HTMLButtonElement>('.cert-file-action-btn.move').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const fileId = Number(btn.dataset.fileId);
      const file = fileRecords.find(f => f.id === fileId);
      if (!file) return;

      // Remove existing dropdowns
      document.querySelectorAll('.cert-move-dropdown').forEach(d => d.remove());

      const card = btn.closest('.cert-file-card')!;
      const actions = card.querySelector('.cert-file-actions')!;
      const dropdown = document.createElement('div');
      dropdown.className = 'cert-move-dropdown';
      dropdown.innerHTML = categories
        .map(c => {
          const isCurrent = c.id === file.categoryId;
          return `<div class="cert-move-dropdown-item${isCurrent ? ' current' : ''}" data-target-cat-id="${c.id}">
            <img src="${escapeAttr(c.icon)}" width="14" height="14" alt="" />
            ${escapeHtml(c.name)}${isCurrent ? ' (当前)' : ''}
          </div>`;
        }).join('');
      actions.appendChild(dropdown);

      dropdown.addEventListener('click', async (e) => {
        const target = (e.target as HTMLElement).closest('.cert-move-dropdown-item') as HTMLElement | null;
        if (!target) return;
        const targetCatId = Number(target.dataset.targetCatId);
        if (targetCatId === file.categoryId) { dropdown.remove(); return; }

        file.categoryId = targetCatId;
        await updateFileRecord(file);
        fileRecords = fileRecords.map(f => f.id === file.id ? file : f);

        card.classList.add('fade-out');
        setTimeout(() => {
          renderCertificatesPage();
        }, 200);
      });

      // Close on click outside
      const closeHandler = (e: MouseEvent) => {
        if (!dropdown.contains(e.target as Node)) {
          dropdown.remove();
          document.removeEventListener('click', closeHandler);
        }
      };
      setTimeout(() => document.addEventListener('click', closeHandler), 0);
    });
  });

  // File delete
  document.querySelectorAll<HTMLButtonElement>('.cert-file-action-btn.delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const fileId = Number(btn.dataset.fileId);
      const file = fileRecords.find(f => f.id === fileId);
      if (!file) return;

      if (file._confirmDelete) {
        delete file._confirmDelete;
        await deleteFileRecord(fileId);
        fileRecords = fileRecords.filter(f => f.id !== fileId);
        renderCertificatesPage();
      } else {
        file._confirmDelete = true;
        renderCertificatesPage();
        setTimeout(() => {
          if (file._confirmDelete) {
            file._confirmDelete = false;
            renderCertificatesPage();
          }
        }, 3000);
      }
    });
  });
}

function showPreviewModal(file: FileRecord) {
  const isImage = IMAGE_TYPES.has(file.fileType);
  const isPdf = file.fileType === 'application/pdf';
  const sameCategoryFiles = fileRecords.filter(f => f.categoryId === file.categoryId && IMAGE_TYPES.has(f.fileType));
  const currentIdx = sameCategoryFiles.findIndex(f => f.id === file.id);
  const hasNav = isImage && sameCategoryFiles.length > 1;

  let navHtml = '';
  if (hasNav) {
    navHtml = `
      <button class="cert-modal-nav prev" id="modalPrev">&#8249;</button>
      <button class="cert-modal-nav next" id="modalNext">&#8250;</button>
    `;
  }

  let bodyHtml: string;
  if (isImage) {
    const url = URL.createObjectURL(file.fileBody);
    bodyHtml = `<img src="${url}" alt="${escapeAttr(file.filename)}" />`;
  } else if (isPdf) {
    bodyHtml = `
      <div style="text-align:center">
        <div style="font-size:48px;margin-bottom:12px">📄</div>
      </div>
    `;
  } else {
    const { icon } = getFileCategoryIcon(file.fileType);
    bodyHtml = `
      <div style="text-align:center">
        <div style="font-size:48px;margin-bottom:12px">${icon}</div>
      </div>
    `;
  }

  let footerHtml = '';
  if (!isImage || !hasNav) {
    footerHtml = `
      <div class="cert-modal-info">
        <div class="cert-modal-info-name">${escapeHtml(file.filename)}</div>
        <div class="cert-modal-info-meta">
          <span>${formatFileSize(file.fileSize)}</span>
          <span>${file.fileType}</span>
        </div>
        ${isPdf ? `<button class="cert-modal-info-open" id="modalOpenNewTab">在新标签页中打开</button>` : ''}
      </div>
    `;
  }

  const overlay = document.createElement('div');
  overlay.className = 'cert-modal-overlay';
  overlay.innerHTML = `
    <div class="cert-modal">
      <button class="cert-modal-close" id="modalClose">&times;</button>
      ${navHtml}
      <div class="cert-modal-body">${bodyHtml}</div>
      ${footerHtml}
    </div>
  `;
  document.body.appendChild(overlay);

  let blobUrls: string[] = sameCategoryFiles.map(f => URL.createObjectURL(f.fileBody));
  let viewIdx = currentIdx;
  let imgEl = overlay.querySelector('.cert-modal-body img') as HTMLImageElement;

  function updateModalImage() {
    if (imgEl) {
      imgEl.src = blobUrls[viewIdx];
    }
  }

  overlay.querySelector('#modalClose')?.addEventListener('click', () => {
    overlay.remove();
    blobUrls.forEach(u => URL.revokeObjectURL(u));
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      blobUrls.forEach(u => URL.revokeObjectURL(u));
    }
  });

  if (hasNav) {
    overlay.querySelector('#modalPrev')?.addEventListener('click', () => {
      viewIdx = (viewIdx - 1 + sameCategoryFiles.length) % sameCategoryFiles.length;
      updateModalImage();
    });
    overlay.querySelector('#modalNext')?.addEventListener('click', () => {
      viewIdx = (viewIdx + 1) % sameCategoryFiles.length;
      updateModalImage();
    });
  }

  if (isPdf) {
    overlay.querySelector('#modalOpenNewTab')?.addEventListener('click', () => {
      const url = URL.createObjectURL(file.fileBody);
      window.open(url, '_blank');
    });
  }

  // Keyboard nav
  const keyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      overlay.remove();
      blobUrls.forEach(u => URL.revokeObjectURL(u));
      document.removeEventListener('keydown', keyHandler);
    }
    if (hasNav) {
      if (e.key === 'ArrowLeft') {
        viewIdx = (viewIdx - 1 + sameCategoryFiles.length) % sameCategoryFiles.length;
        updateModalImage();
      }
      if (e.key === 'ArrowRight') {
        viewIdx = (viewIdx + 1) % sameCategoryFiles.length;
        updateModalImage();
      }
    }
  };
  document.addEventListener('keydown', keyHandler);
}

// ===== Settings Page =====
function renderSettingsPage() {
  const api = apiConfigData ?? { baseUrl: '', apiKey: '', model: '', providerId: '' };

  nextFieldId = 0;
  const settingsFieldMap = Object.fromEntries(textFields.map((f) => [f.key, f.value]));

  const defaultFieldRows = DEFAULT_FIELDS.map((df) => {
    return createFieldRowHtml(df.key, settingsFieldMap[df.key] ?? '', true);
  }).join('');

  const customFields = textFields.filter((f) => !DEFAULT_FIELD_KEYS.has(f.key));
  const customFieldRows = customFields.map((f) => createFieldRowHtml(f.key, f.value, false)).join('');

  pageContent.innerHTML = `
    <div class="settings-form">
      <div class="settings-section">
        <h2>个人信息</h2>
        <div id="fieldList">${defaultFieldRows}${customFieldRows}</div>
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

function createFieldRowHtml(key: string, value: string, locked = false): string {
  const id = nextFieldId++;
  if (locked) {
    const label = DEFAULT_FIELD_LABELS[key] ?? key;
    return `
      <div class="field-row field-row-locked" data-id="${id}" data-key="${escapeAttr(key)}">
        <span class="field-key-label">${escapeHtml(label)}</span>
        <input type="text" class="field-value" placeholder="字段值" value="${escapeHtml(value)}" />
      </div>
    `;
  }
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
  const seenKeys = new Set<string>();

  // Collect default fields first (locked rows with data-key)
  for (const df of DEFAULT_FIELDS) {
    const lockedRow = document.querySelector<HTMLElement>(`.field-row-locked[data-key="${df.key}"]`);
    const fieldValue = lockedRow
      ? ((lockedRow.querySelector('.field-value') as HTMLInputElement)?.value.trim() ?? '')
      : '';
    fields.push({ key: df.key, value: fieldValue });
    seenKeys.add(df.key);
  }

  rows.forEach((row) => {
    const key = (row.querySelector('.field-key') as HTMLInputElement)?.value.trim() ?? '';
    if (!key || seenKeys.has(key)) return;
    const value = (row.querySelector('.field-value') as HTMLInputElement)?.value.trim() ?? '';
    fields.push({ key, value });
    seenKeys.add(key);
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
  const [rawFields, apiConfig, blocks, cats, files] = await Promise.all([
    getAllTextFields(),
    getApiConfig(),
    getAllBlockCategories(),
    getAllCategories(),
    getAllFileRecords(),
  ]);
  let fields = rawFields;

  // Migrate old Chinese keys → new English keys
  const KEY_MIGRATION: Record<string, string> = {
    '姓名': 'name',
    '手机号': 'phone',
    '手机号码': 'phone',
    '电话': 'phone',
    '邮箱': 'email',
    '电子邮件': 'email',
    '地址': 'address',
    '住址': 'address',
    '家庭住址': 'address',
  };
  const mFieldMap = new Map<string, string>();
  const migratedKeys = new Set<string>();
  for (const f of fields) {
    const targetKey = KEY_MIGRATION[f.key] ?? f.key;
    if (!mFieldMap.has(targetKey) || (f.value && !mFieldMap.get(targetKey))) {
      mFieldMap.set(targetKey, f.value);
    }
    if (KEY_MIGRATION[f.key]) migratedKeys.add(f.key);
  }

  if (migratedKeys.size > 0) {
    fields = Array.from(mFieldMap, ([key, value]) => ({ key, value }));
  }

  // Seed default fields if missing
  const existingKeys = new Set(fields.map((f) => f.key));
  let needSave = false;
  for (const df of DEFAULT_FIELDS) {
    if (!existingKeys.has(df.key)) {
      fields.push({ key: df.key, value: '' });
      needSave = true;
    }
  }
  if (needSave || migratedKeys.size > 0) {
    await saveAllTextFields(fields);
  }

  textFields = fields;
  apiConfigData = apiConfig;
  blockCategories = blocks;
  categories = cats;
  fileRecords = files;

  switchPage('profile');
}

init();
