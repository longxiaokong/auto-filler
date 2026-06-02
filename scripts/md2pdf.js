import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const mdPath = path.resolve(__dirname, '../docs/技术方案.md');
const pdfPath = path.resolve(__dirname, '../docs/技术方案.pdf');
const cssPath = path.resolve(__dirname, '../docs/tech-doc.css');

const mdContent = fs.readFileSync(mdPath, 'utf-8');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

const htmlBody = marked.parse(mdContent);

const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>${cssContent}</style>
</head>
<body>
${htmlBody}
</body>
</html>`;

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setContent(fullHtml, { waitUntil: 'networkidle0', timeout: 30000 });
await page.pdf({
  path: pdfPath,
  format: 'A4',
  margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
  printBackground: true,
  displayHeaderFooter: false,
});

await browser.close();
console.log(`PDF generated: ${pdfPath}`);
console.log(`Size: ${(fs.statSync(pdfPath).size / 1024).toFixed(1)} KB`);
