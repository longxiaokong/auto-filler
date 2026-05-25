const fs = require('node:fs');
const path = require('node:path');

const mdPath = path.resolve('docs/技术方案.md');
const pdfPath = path.resolve('docs/技术方案.pdf');
const mdContent = fs.readFileSync(mdPath, 'utf-8');

// Simple markdown to HTML conversion
function mdToHtml(md) {
  let html = md
    // Code blocks (``` ... ```)
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="language-${lang || ''}">${escapeHtml(code.trimEnd())}</code></pre>`)
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Headers
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold & italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />')
    // Horizontal rules
    .replace(/^---$/gm, '<hr>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // Tables
    .replace(/^\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)*)/gm, (_, header, body) => {
      const headers = header.split('|').map(h => h.trim()).filter(Boolean);
      const rows = body.trim().split('\n').map(row =>
        row.split('|').map(c => c.trim()).filter(Boolean)
      );
      let table = '<table><thead><tr>';
      headers.forEach(h => { table += `<th>${h}</th>`; });
      table += '</tr></thead><tbody>';
      rows.forEach(row => {
        table += '<tr>';
        row.forEach(c => { table += `<td>${c}</td>`; });
        table += '</tr>';
      });
      table += '</tbody></table>';
      return table;
    })
    // Paragraphs (double newlines)
    .split(/\n\n+/).map(block => {
      block = block.trim();
      if (!block) return '';
      if (/^<(h[1-4]|ul|ol|table|pre|blockquote|hr)/.test(block)) return block;
      return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');

  return html;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const htmlBody = mdToHtml(mdContent);

const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&display=swap');

  * { box-sizing: border-box; }

  body {
    font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans SC", "SimHei", sans-serif;
    font-size: 13px;
    line-height: 1.8;
    color: #1F2937;
    max-width: 900px;
    margin: 0 auto;
    padding: 40px 50px;
  }

  h1 {
    font-size: 26px;
    font-weight: 700;
    color: #111827;
    border-bottom: 2px solid #257FFD;
    padding-bottom: 10px;
    margin-top: 0;
    margin-bottom: 24px;
  }

  h2 {
    font-size: 20px;
    font-weight: 600;
    color: #1F2937;
    margin-top: 36px;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid #E5EAF2;
  }

  h3 {
    font-size: 16px;
    font-weight: 600;
    color: #374151;
    margin-top: 28px;
    margin-bottom: 12px;
  }

  h4 {
    font-size: 14px;
    font-weight: 600;
    color: #4B5563;
    margin-top: 20px;
    margin-bottom: 8px;
  }

  p { margin: 0 0 10px 0; }

  code {
    font-family: "Cascadia Code", "Fira Code", "Consolas", monospace;
    font-size: 12px;
    background: #F3F4F6;
    padding: 2px 6px;
    border-radius: 4px;
    color: #DC2626;
  }

  pre {
    background: #1F2937;
    color: #E5E7EB;
    padding: 16px 20px;
    border-radius: 8px;
    overflow-x: auto;
    font-size: 12px;
    line-height: 1.6;
    margin: 12px 0 16px 0;
  }

  pre code {
    background: none;
    color: inherit;
    padding: 0;
    font-size: inherit;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0 16px 0;
    font-size: 12px;
  }

  th, td {
    border: 1px solid #E5EAF2;
    padding: 8px 12px;
    text-align: left;
  }

  th {
    background: #F9FAFB;
    font-weight: 600;
    color: #374151;
  }

  tr:nth-child(even) td {
    background: #F9FAFB;
  }

  ul, ol {
    margin: 8px 0;
    padding-left: 24px;
  }

  li { margin-bottom: 4px; }

  blockquote {
    border-left: 3px solid #257FFD;
    padding: 8px 16px;
    margin: 12px 0;
    background: #F0F6FF;
    color: #4B5563;
  }

  hr {
    border: none;
    border-top: 1px solid #E5EAF2;
    margin: 24px 0;
  }

  a { color: #257FFD; text-decoration: none; }

  strong { font-weight: 600; }
</style>
</head>
<body>
${htmlBody}
</body>
</html>`;

fs.writeFileSync(pdfPath.replace('.pdf', '.html'), fullHtml, 'utf-8');
console.log('HTML written to', pdfPath.replace('.pdf', '.html'));
