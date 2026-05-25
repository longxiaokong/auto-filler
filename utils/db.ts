export interface TextField {
  id?: number;
  key: string;
  value: string;
}

export interface BlockItem {
  fields: { key: string; value: string }[];
}

export interface BlockCategory {
  id?: number;
  title: string;
  items: BlockItem[];
}

export interface FileRecord {
  id?: number;
  filename: string;
  fileType: string;
  fileBody: Blob;
  fileSize: number;
  fileDescription: string;
  createdAt: number;
}

const DB_NAME = 'autoFillerDB';
const DB_VERSION = 2;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('textFields')) {
        db.createObjectStore('textFields', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('fileRecords')) {
        const store = db.createObjectStore('fileRecords', { keyPath: 'id', autoIncrement: true });
        store.createIndex('fileType', 'fileType', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('blockCategories')) {
        db.createObjectStore('blockCategories', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Text Fields ──

export async function getAllTextFields(): Promise<TextField[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('textFields', 'readonly');
    const req = tx.objectStore('textFields').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function hasTextFields(): Promise<boolean> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('textFields', 'readonly');
    const req = tx.objectStore('textFields').count();
    req.onsuccess = () => resolve(req.result > 0);
    req.onerror = () => reject(req.error);
  });
}

export async function saveAllTextFields(fields: { key: string; value: string }[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('textFields', 'readwrite');
    const store = tx.objectStore('textFields');
    store.clear();
    for (const f of fields) {
      if (f.key.trim()) {
        store.add({ key: f.key.trim(), value: f.value });
      }
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── File Records ──

export async function getAllFileRecords(): Promise<FileRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('fileRecords', 'readonly');
    const req = tx.objectStore('fileRecords').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addFileRecord(record: Omit<FileRecord, 'id'>): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('fileRecords', 'readwrite');
    const req = tx.objectStore('fileRecords').add(record);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteFileRecord(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('fileRecords', 'readwrite');
    const req = tx.objectStore('fileRecords').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Block Categories ──

export async function getAllBlockCategories(): Promise<BlockCategory[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('blockCategories', 'readonly');
    const req = tx.objectStore('blockCategories').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveBlockCategory(category: BlockCategory): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('blockCategories', 'readwrite');
    const store = tx.objectStore('blockCategories');
    let req: IDBRequest;
    if (category.id != null) {
      req = store.put(category);
    } else {
      req = store.add(category);
    }
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteBlockCategory(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('blockCategories', 'readwrite');
    const req = tx.objectStore('blockCategories').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
