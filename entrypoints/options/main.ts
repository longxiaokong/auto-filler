import { getApiConfig, setApiConfig } from '../../utils/storage';
import type { ApiConfig } from '../../utils/storage';
import { getAllTextFields, saveAllTextFields, getAllFileRecords, addFileRecord, deleteFileRecord } from '../../utils/db';
import type { TextField, FileRecord } from '../../utils/db';

// ── DOM refs ──

const textFieldList = document.getElementById('textFieldList')!;
const addFieldBtn = document.getElementById('addFieldBtn')!;
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const fileDesc = document.getElementById('fileDesc') as HTMLInputElement;
const uploadBtn = document.getElementById('uploadBtn')!;
const fileList = document.getElementById('fileList')!;
const baseUrlEl = document.getElementById('baseUrl') as HTMLInputElement;
const apiKeyEl = document.getElementById('apiKey') as HTMLInputElement;
const modelEl = document.getElementById('model') as HTMLInputElement;
const saveBtn = document.getElementById('saveBtn')!;
const statusMsg = document.getElementById('statusMsg')!;

// ── Text Fields ──

let textFields: { key: string; value: string }[] = [];
let nextFieldId = 0;

function createFieldRow(key: string, value: string): HTMLDivElement {
  const id = nextFieldId++;
  const row = document.createElement('div');
  row.className = 'field-row';
  row.dataset.id = String(id);
  row.innerHTML = `
    <input type="text" class="field-key" placeholder="字段名" value="${escapeHtml(key)}" />
    <input type="text" class="field-value" placeholder="字段值" value="${escapeHtml(value)}" />
    <button class="btn-delete" title="删除">×</button>
  `;
  row.querySelector('.btn-delete')!.addEventListener('click', () => row.remove());
  return row;
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function addFieldRow(key = '', value = '') {
  const row = createFieldRow(key, value);
  textFieldList.appendChild(row);
}

addFieldBtn.addEventListener('click', () => addFieldRow());

// ── File Records ──

function createFileRow(record: FileRecord): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'file-row';
  row.dataset.id = String(record.id);
  const sizeStr = record.fileSize < 1024
    ? `${record.fileSize} B`
    : record.fileSize < 1024 * 1024
      ? `${(record.fileSize / 1024).toFixed(1)} KB`
      : `${(record.fileSize / (1024 * 1024)).toFixed(1)} MB`;
  row.innerHTML = `
    <span class="file-info">
      <span class="file-name">${escapeHtml(record.filename)}</span>
      <span class="file-type">${record.fileType}</span>
      <span class="file-size">${sizeStr}</span>
      <span class="file-desc">${escapeHtml(record.fileDescription)}</span>
    </span>
    <button class="btn-delete" title="删除">×</button>
  `;
  row.querySelector('.btn-delete')!.addEventListener('click', async () => {
    if (record.id != null) await deleteFileRecord(record.id);
    row.remove();
  });
  return row;
}

uploadBtn.addEventListener('click', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  const ext = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() ?? '' : '';
  const fileType = ext;

  await addFileRecord({
    filename: file.name,
    fileType,
    fileBody: file,
    fileSize: file.size,
    fileDescription: fileDesc.value.trim(),
    createdAt: Date.now(),
  });

  fileInput.value = '';
  fileDesc.value = '';

  const records = await getAllFileRecords();
  renderFileList(records);
});

function renderFileList(records: FileRecord[]) {
  fileList.innerHTML = '';
  for (const r of records) {
    fileList.appendChild(createFileRow(r));
  }
}

// ── API Config ──

function showStatus(text: string) {
  statusMsg.textContent = text;
  statusMsg.classList.add('show');
  setTimeout(() => statusMsg.classList.remove('show'), 2000);
}

saveBtn.addEventListener('click', async () => {
  // Save text fields
  const rows = textFieldList.querySelectorAll<HTMLElement>('.field-row');
  const fields: { key: string; value: string }[] = [];
  rows.forEach((row) => {
    const key = (row.querySelector('.field-key') as HTMLInputElement).value.trim();
    const value = (row.querySelector('.field-value') as HTMLInputElement).value;
    if (key) fields.push({ key, value });
  });

  await saveAllTextFields(fields);

  // Save API config
  await setApiConfig({
    baseUrl: baseUrlEl.value.trim(),
    apiKey: apiKeyEl.value.trim(),
    model: modelEl.value.trim(),
  });

  showStatus('已保存');
});

// ── Init ──

async function load() {
  const [fields, files, apiConfig] = await Promise.all([
    getAllTextFields(),
    getAllFileRecords(),
    getApiConfig(),
  ]);

  for (const f of fields) {
    addFieldRow(f.key, f.value);
  }

  renderFileList(files);

  baseUrlEl.value = apiConfig.baseUrl;
  apiKeyEl.value = apiConfig.apiKey;
  modelEl.value = apiConfig.model;
}

load();
