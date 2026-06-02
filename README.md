# 秒填鸭

[English](README.en.md) | 中文

一款基于 LLM 语义匹配的 Chrome 表单自动填充扩展。支持文本字段填充和 PDF 证明材料按需合成，所有数据本地存储，无需注册账号。

<div align="center">
  <a href="../../releases/latest"><b>⬇️ 下载安装</b></a>
</div>

<div align="center">
  <img src="assets/1-popup.png" width="210" alt="Popup" />
  <img src="assets/2-filling.png" width="210" alt="Filling" />
  <img src="assets/3-page.png" width="210" alt="Result" />
</div>

## 功能

### 智能表单填充
- 扫描页面表单字段（label、placeholder、aria-label、name、id）
- 通过 LLM 语义匹配，将用户存储的个人信息自动填入对应字段
- 支持 React 等框架页面的表单（使用原生 setter 触发变更）
- 匹配结果展示置信度，用户可逐项确认后再填充

### 证明材料管理
- 支持上传图片（JPG/PNG/WebP）和 PDF 文件
- 按分类管理材料（身份证明、学历证明、资格证书、个人照片等）
- 支持预览、重命名、移动分类、删除

### PDF 合成
- 从证明材料中选取图片和 PDF，拖拽排序后合并为一个 PDF
- 支持本地上传新文件（自动存入证明材料）
- 图片自动缩放适配 A4 页面，居中留白
- 合成结果保存到证明材料，随时下载
- 纯浏览器端操作，无需服务端

### API 配置
- 支持任何 OpenAI 兼容的 API（国内厂商、聚合平台、第三方等）
- 预置主流供应商配置，填入 API Key 即可使用
- 也支持自定义 Base URL 和模型名称

## 安装

### 从 Release 安装（推荐）

前往 [Releases](../../releases) 下载对应压缩包：

| 文件 | 适用浏览器 |
|------|-----------|
| `auto-filler-chrome.zip` | Chrome / Edge / Brave 等 Chromium 内核浏览器 |
| `auto-filler-firefox.zip` | Firefox |

**Chrome / Edge：**

1. 打开 `chrome://extensions/`（Edge 为 `edge://extensions/`）
2. 开启右上角「开发者模式」
3. 将下载的 zip 文件**直接拖入页面**

**Firefox：**

1. 打开 `about:debugging#/runtime/this-firefox`
2. 点击「加载临时附加组件」
3. 选择下载的 zip 文件（Firefox 会将扩展标记为临时，重启后需重新加载）

### 从源码构建

```bash
npm install
npm run build            # Chrome
npm run build:firefox    # Firefox
```

构建产物在 `.output/` 目录，可在浏览器扩展管理页面以「加载已解压的扩展程序」方式加载。

### 打包

```bash
npm run zip            # Chrome
npm run zip:firefox    # Firefox
```

产物在 `.output/` 目录，可直接上传到 Chrome Web Store 或 GitHub Releases。

## 使用方式

1. **配置 API**：点击扩展图标 → 设置 → 填写 API 地址和 Key
2. **录入信息**：在设置页填写个人常用信息（姓名、手机、邮箱、地址等），支持自定义字段
3. **上传材料**：在证书材料页上传证明文件，按分类整理
4. **填充表单**：浏览目标网页 → 点击扩展图标 → 扫描 → 确认匹配 → 填充
5. **合成 PDF**：在 PDF 汇总页选取材料 → 排序 → 合成 → 在证书材料中下载

## 技术栈

- **框架**: [WXT](https://wxt.dev/) (基于 Vite 的浏览器扩展框架)
- **语言**: TypeScript
- **UI**: 原生 HTML/CSS，无框架
- **PDF**: [pdf-lib](https://pdf-lib.js.org/)
- **拼音**: [pinyin-pro](https://github.com/nicoleee-h/pinyin-pro)
- **数据存储**: IndexedDB + chrome.storage.local

## 项目结构

```
├── entrypoints/
│   ├── background.ts        # Service Worker：消息路由、LLM 调用
│   ├── content.ts           # 内容脚本：扫描 DOM、填充表单
│   ├── popup/               # 弹出窗口：扫描→确认→填充
│   └── options/             # 选项页：信息管理、材料管理、PDF 合成、设置
├── utils/
│   ├── db.ts                # IndexedDB 封装
│   ├── storage.ts           # chrome.storage 封装
│   ├── matcher.ts           # LLM 语义匹配
│   ├── pdf-merge.ts         # PDF 合成逻辑
│   └── providers.ts         # API 供应商预设
└── public/icons/            # 静态图标资源
```

## 开发

```bash
npm run dev              # Chrome 开发模式（HMR）
npm run dev:firefox      # Firefox 开发模式
npm run compile          # 类型检查
```

## TODO

- **自动录入个人信息**：扫描页面表单后，将未被匹配的字段直接添加到个人信息库，免去逐条手动录入
- **材料可视化拖拽上传**：提供悬浮窗或弹窗界面，支持手动拖拽材料到页面文件上传区域，解决需要上传证明材料的场景

## License

Licensed under the [Apache License 2.0](LICENSE).
