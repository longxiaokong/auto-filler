# Certificate Materials Page Design

## Overview

证书材料页面：既是个人材料库（供自动填表时调用），也是证书档案（展示和查看）。采用文件夹展开式布局，左侧分类栏 + 右侧文件列表。

## Data Model

### Category Store（新增 IndexedDB `categories`）

```typescript
interface Category {
  id?: number;        // autoIncrement
  name: string;       // "身份证明"
  icon: string;       // SVG asset path, e.g. "/icons/id-card.svg"
  sortOrder: number;  // display order
  isDefault: boolean; // only "未分类" is true, cannot be deleted
}
```

Preset categories (seeded on first init):

| name | icon | isDefault |
|------|------|-----------|
| 身份证明 | id-card.svg | false |
| 学历证明 | education.svg | false |
| 资格证书 | certificate.svg | false |
| 个人照片 | photo.svg | false |
| 未分类 | folder.svg | true |

### FileRecord Store（扩展现有 `fileRecords`）

```typescript
interface FileRecord {
  id?: number;
  filename: string;
  fileType: string;      // MIME type
  fileBody: Blob;
  fileSize: number;
  fileDescription: string;
  categoryId: number;    // NEW: belongs to category, 0/null → 未分类
  createdAt: number;
}
```

### DB Upgrade

Version 2 → 3:
- Add `categories` object store with `keyPath: "id", autoIncrement: true`
- Add `categoryId` index on `fileRecords`

## Page Layout

```
┌──────────────────────────────────────────────────────────┐
│  证书材料                                    管理与维护...  │
├───────────┬──────────────────────────────────────────────┤
│ 分类管理   │  [搜索框]              [Upload Button]       │
│           │──────────────────────────────────────────────│
│ [icon] 身份│  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────┐│
│    3 个文件│  │thumb   │ │thumb   │ │thumb   │ │thumb ││
│ [icon] 学历│  │        │ │        │ │        │ │      ││
│    2 个文件│  ├────────┤ ├────────┤ ├────────┤ ├──────┤│
│ [icon] 资格│  │filename│ │filename│ │filename│ │name  ││
│    0 个文件│  │2.1MB   │ │3.4MB   │ │156KB   │ │4.2MB ││
│ [icon] 照片│  └────────┘ └────────┘ └────────┘ └──────┘│
│    1 个文件│                                              │
│ [icon] 未分│                                              │
│    0 个文件│                                              │
│           │                                              │
│ ───────── │                                              │
│ + 新增分类 │                                              │
└───────────┴──────────────────────────────────────────────┘
```

### Left Sidebar (~180px)

- Category list: SVG icon + name + file count
- Active category highlighted
- Bottom: "+ 新增分类" button → inline edit input
- Hover: show rename/delete actions
- Click category → switch right panel

### Right Panel

- Top bar: search input (filter by filename/description) + upload button
- File card grid: 4 columns, responsive
- Empty state: upload guidance prompt when category has no files

## Interactions

### Upload

- Click upload button → `<input type="file" multiple>`
- Accepted types: images (jpg/png/webp), PDF, Word (doc/docx)
- Files assigned to currently selected category
- Auto-scroll to newly uploaded files
- Duplicate filenames allowed

### Preview Modal

- Overlay + centered modal
- Image types: render `<img>` in modal, left/right arrows to browse same-category images
- PDF: info card (name, size, type) + "Open in new tab" button
- Other types: info card with file metadata
- Close via X button or clicking overlay

### Category Management

- **Add**: bottom button → inline input + confirm/cancel, empty input cancels
- **Rename**: double-click category name → inline edit, Enter confirms, Esc cancels
- **Delete**: hover shows delete icon → click → name turns red + "确认删除？" → click again to execute
  - Files in deleted category auto-move to "未分类"
  - "未分类" cannot be deleted

### File Actions

- Hover file card → show action buttons: preview, move, delete
- **Move**: click move icon → category dropdown → select target → file moves, card fades out
- **Delete**: confirmation state pattern (same as profile page)

## Out of Scope (Future Phase)

- File content parsing (PDF text extraction, OCR) → P1 "材料匹配 + 自动上传"
- File size limits / progress bar
- Drag-and-drop reorder
- Drag-and-drop file upload

## Implementation Notes

- Follow existing Options page patterns (imperative DOM, event delegation, inline editing)
- SVG icons from `public/icons/` instead of emoji
- Reuse `.material-item` / `.material-thumb` CSS patterns from profile page where applicable
- DB upgrade must handle existing `fileRecords` gracefully (assign to "未分类" if no categoryId)
