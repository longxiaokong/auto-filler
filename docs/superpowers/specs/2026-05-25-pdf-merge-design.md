# PDF Merge Feature Design

## Overview

在 Options 页的「PDF 汇总」导航项下新增 PDF 合成功能。用户可以从证明材料（fileRecords）中选取图片和 PDF，也可以本地上传新文件，通过拖拽排序后合并成一个 PDF，保存回证明材料数据库并提供下载。

## Data Flow

1. 用户进入 PDF 汇总页面
2. 从证明材料选取文件，或本地上传新文件（上传时自动存入 fileRecords，categoryId 为未分类）
3. 拖拽排序文件列表
4. 输入合成文件名
5. 点击「合成 PDF」
6. pdf-lib 依次处理：图片→A4 页面（保持宽高比居中留白），PDF→拷贝全部页面
7. 合成结果保存为新的 FileRecord（Blob），同时触发浏览器下载

## UI Design

### 页面布局（方案 A：列表式）

```
┌─────────────────────────────────┐
│  PDF 汇总                        │
├─────────────────────────────────┤
│  文件名: [________________] .pdf  │
├─────────────────────────────────┤
│  ┌───┬────────────┬───┬───┐     │
│  │ ☰ │ 🖼 thumb  │ ✕ │   │     │
│  ├───┼────────────┼───┤   │     │
│  │ ☰ │ 📄 pdf     │ ✕ │   │     │
│  ├───┼────────────┼───┤   │     │
│  │ ☰ │ 🖼 thumb  │ ✕ │   │     │
│  └───┴────────────┴───┴───┘     │
│                                  │
│  [+ 从证明材料选取] [+ 本地上传]   │
│                                  │
│  [合成 PDF]                      │
└─────────────────────────────────┘
```

### 交互细节

- **文件卡片**：左侧拖拽手柄（☰）+ 缩略图（图片显示预览，PDF 显示 PDF 图标）+ 文件名，右侧删除按钮
- **拖拽排序**：HTML5 Drag and Drop API，拖拽手柄触发，拖拽过程中有占位符指示插入位置
- **从证明材料选取**：弹出模态框，展示 fileRecords 中所有图片和 PDF，支持多选勾选，确认后添加到列表（不删除源文件）
- **本地上传**：触发文件选择器，仅接受图片和 PDF，上传后自动存入 fileRecords（未分类）并添加到列表
- **合成按钮**：列表为空时禁用
- **文件类型过滤**：仅允许 png/jpg/jpeg/webp/pdf

### 合成逻辑

```
对列表中的每个文件：
  if 图片 (png/jpg/webp):
    读取 Blob → ArrayBuffer
    embedJpg/embedPng 到新 A4 页面
    图片居中，等比缩放适配页面（留白）
  if PDF:
    读取 Blob → ArrayBuffer
    PDFDocument.load → copyPages 到目标文档
    PDF 的每一页按顺序插入
```

- 页面尺寸：A4 (595.28 × 841.89 pt)
- 图片适配逻辑：`scale = Math.min(pageWidth * 0.9 / imgWidth, pageHeight * 0.9 / imgHeight)`，居中放置

## Technical Details

### New Dependency

- `pdf-lib` — PDF 创建、图片嵌入、PDF 合并

### New Module

- `utils/pdf-merge.ts` — 核心合成逻辑，导出 `mergeFilesToPdf(files: MergeFileItem[]): Promise<Blob>`
  - `MergeFileItem { type: 'image' | 'pdf', name: string, data: ArrayBuffer }`

### Modified Files

| File | Change |
|------|--------|
| `entrypoints/options/index.html` | PDF 页面内容区 HTML 结构 |
| `entrypoints/options/main.ts` | PDF 页面的交互逻辑（选取、排序、合成、下载） |
| `entrypoints/options/style.css` | PDF 页面样式 |
| `utils/db.ts` | 无改动，复用现有 addFileRecord |
| `package.json` | 新增 pdf-lib 依赖 |

### File Record for Merged PDF

合成后的 PDF 作为新 FileRecord 存储：
- `filename`: 用户输入的文件名
- `fileType`: `'application/pdf'`
- `fileBody`: Blob (合成结果)
- `fileSize`: Blob.size
- `fileDescription`: 空字符串
- `categoryId`: 未分类（0 或默认值）

## Constraints

- 仅支持图片（png/jpg/jpeg/webp）和 PDF，doc/docx 不参与
- webp 需先转换为 png 再嵌入（pdf-lib 不支持 webp），用 Canvas API 转换
- 本地上传的文件自动存入 fileRecords（未分类），不从证明材料中删除
- 合成是纯浏览器端操作，不需要服务端
