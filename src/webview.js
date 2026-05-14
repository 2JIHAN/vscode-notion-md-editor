/**
 * Preview, WYSIWYG webview의 HTML 템플릿.
 *
 * markdown 모듈로 본문을 HTML로 렌더링한 뒤 webview용 wrapper에 삽입한다.
 * webview script는 browser context에서 실행되므로, 공유 상수는 JSON으로
 * 직렬화해 inline data로 주입한다.
 */

const { renderHtml, parse } = require('./markdown');
const { CALLOUTS } = require('./callouts');

const COMMON_STYLE = `
  body {
    color: var(--vscode-editor-foreground);
    background: var(--vscode-editor-background);
    font-family: var(--vscode-font-family);
    line-height: 1.65;
  }
  h1, h2, h3 { line-height: 1.25; }
  code {
    background: var(--vscode-textCodeBlock-background);
    border-radius: 4px;
    padding: 0.1em 0.35em;
  }
  pre {
    background: var(--vscode-textCodeBlock-background);
    border-radius: 8px;
    overflow: auto;
    padding: 14px 16px;
  }
  blockquote {
    border-left: 4px solid var(--vscode-textBlockQuote-border);
    color: var(--vscode-textBlockQuote-foreground);
    margin: 1em 0;
    padding: 0.1em 1em;
  }
  .callout {
    border-radius: 10px;
    display: grid;
    grid-template-columns: 28px 1fr;
    gap: 10px;
    margin: 16px 0;
    padding: 14px 16px;
  }
  .callout-icon { line-height: 1.6; }
  .callout.green_bg { background: rgba(46, 160, 67, 0.14); }
  .callout.yellow_bg { background: rgba(187, 128, 9, 0.16); }
  .callout.blue_bg { background: rgba(56, 139, 253, 0.14); }
  .callout.gray_bg { background: rgba(127, 127, 127, 0.14); }
  .callout-content > :first-child { margin-top: 0; }
  .callout-content > :last-child { margin-bottom: 0; }
`;

function renderPreview(markdown) {
  const body = renderHtml(markdown);
  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    ${COMMON_STYLE}
    body { padding: 28px; max-width: 860px; margin: 0 auto; }
  </style>
</head>
<body>${body}</body>
</html>`;
}

function renderWysiwygEditor(markdown) {
  const frontmatter = extractFrontmatter(markdown);
  const body = renderHtml(markdown);
  const calloutsJson = JSON.stringify(CALLOUTS);
  const frontmatterJson = JSON.stringify(frontmatter);
  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    ${COMMON_STYLE}
    body { margin: 0; }
    .toolbar {
      align-items: center;
      backdrop-filter: blur(10px);
      background: var(--vscode-editor-background);
      border-bottom: 1px solid var(--vscode-editorWidget-border);
      display: flex;
      gap: 6px;
      padding: 10px 14px;
      position: sticky;
      top: 0;
      z-index: 2;
    }
    button, select {
      background: var(--vscode-button-secondaryBackground);
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 6px;
      color: var(--vscode-button-secondaryForeground);
      cursor: pointer;
      font: inherit;
      padding: 5px 9px;
    }
    button:hover, select:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .status { color: var(--vscode-descriptionForeground); margin-left: auto; }
    #editor {
      line-height: 1.65;
      margin: 0 auto;
      max-width: 860px;
      min-height: calc(100vh - 54px);
      outline: none;
      padding: 32px 28px 64px;
    }
    #editor:empty::before {
      color: var(--vscode-descriptionForeground);
      content: 'Notion 스타일 Markdown 작성...';
    }
    h1, h2, h3 { margin: 1.25em 0 0.55em; }
    p { margin: 0.7em 0; }
    .callout-content { outline: none; }
  </style>
</head>
<body>
  <div class="toolbar">
    <button data-command="h1">H1</button>
    <button data-command="h2">H2</button>
    <button data-command="bold"><strong>B</strong></button>
    <button data-command="code">Code</button>
    <select id="calloutKind" title="Callout kind">
      <option value="success">✅ 성공 기준</option>
      <option value="warning">⚠️ 주의</option>
      <option value="info">💡 정보</option>
    </select>
    <button data-command="callout">Callout</button>
    <span class="status" id="status">Saved to VS Code document</span>
  </div>
  <main id="editor" contenteditable="true" spellcheck="true">${body}</main>
  <script>
    const vscode = acquireVsCodeApi();
    const editor = document.getElementById('editor');
    const status = document.getElementById('status');
    const callouts = ${calloutsJson};
    const frontmatter = ${frontmatterJson};
    let timer;

    document.querySelector('.toolbar').addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      runCommand(button.dataset.command);
    });

    editor.addEventListener('input', scheduleUpdate);
    editor.addEventListener('paste', (event) => {
      event.preventDefault();
      const text = event.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
    });

    function runCommand(command) {
      editor.focus();
      if (command === 'h1') document.execCommand('formatBlock', false, 'h1');
      if (command === 'h2') document.execCommand('formatBlock', false, 'h2');
      if (command === 'bold') document.execCommand('bold');
      if (command === 'code') wrapSelection('code');
      if (command === 'callout') insertCallout();
      scheduleUpdate();
    }

    function insertCallout() {
      const kind = callouts[document.getElementById('calloutKind').value];
      const html = '<div class="callout ' + kind.color + '" data-icon="' + kind.icon + '" data-color="' + kind.color + '"><div class="callout-icon">' + kind.icon + '</div><div class="callout-content"><p><strong>' + kind.title + '</strong></p><p><br></p></div></div>';
      document.execCommand('insertHTML', false, html);
    }

    function wrapSelection(tagName) {
      const selection = window.getSelection();
      if (!selection.rangeCount || selection.isCollapsed) return;
      const range = selection.getRangeAt(0);
      const element = document.createElement(tagName);
      element.textContent = range.toString();
      range.deleteContents();
      range.insertNode(element);
      selection.removeAllRanges();
    }

    function scheduleUpdate() {
      status.textContent = 'Editing...';
      clearTimeout(timer);
      timer = setTimeout(() => {
        const body = editorToMarkdown(editor);
        const markdown = frontmatter ? frontmatter + '\\n\\n' + body : body;
        vscode.postMessage({ type: 'update', markdown: markdown });
        status.textContent = 'Saved to VS Code document';
      }, 250);
    }

    function editorToMarkdown(root) {
      return Array.from(root.childNodes).map(nodeToMarkdown).filter(Boolean).join('\\n\\n').trim() + '\\n';
    }

    function nodeToMarkdown(node) {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent.trim();
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      const tag = node.tagName.toLowerCase();
      if (tag === 'h1') return '# ' + inlineMarkdown(node);
      if (tag === 'h2') return '## ' + inlineMarkdown(node);
      if (tag === 'h3') return '### ' + inlineMarkdown(node);
      if (tag === 'p' || tag === 'div') {
        if (node.classList.contains('callout')) return calloutToMarkdown(node);
        return inlineMarkdown(node).trim();
      }
      if (tag === 'blockquote') return inlineMarkdown(node).split('\\n').map(line => '> ' + line).join('\\n');
      if (tag === 'pre') return '\\u0060\\u0060\\u0060\\n' + node.textContent.replace(/\\n+$/, '') + '\\n\\u0060\\u0060\\u0060';
      if (tag === 'ul') return Array.from(node.children).map(li => '- ' + inlineMarkdown(li)).join('\\n');
      if (tag === 'ol') return Array.from(node.children).map((li, index) => (index + 1) + '. ' + inlineMarkdown(li)).join('\\n');
      return inlineMarkdown(node).trim();
    }

    function calloutToMarkdown(node) {
      const icon = node.dataset.icon || (node.querySelector('.callout-icon') ? node.querySelector('.callout-icon').textContent.trim() : '💡');
      const color = node.dataset.color || Array.from(node.classList).find(name => name.endsWith('_bg')) || 'gray_bg';
      const content = node.querySelector('.callout-content') || node;
      const markdown = Array.from(content.childNodes).map(nodeToMarkdown).filter(Boolean).join('\\n\\n').trim();
      return '<callout icon="' + icon + '" color="' + color + '">\\n' + markdown + '\\n</callout>';
    }

    function inlineMarkdown(node) {
      return Array.from(node.childNodes).map((child) => {
        if (child.nodeType === Node.TEXT_NODE) return child.textContent.replace(/\\s+/g, ' ');
        if (child.nodeType !== Node.ELEMENT_NODE) return '';
        const tag = child.tagName.toLowerCase();
        const text = inlineMarkdown(child);
        if (tag === 'strong' || tag === 'b') return '**' + text + '**';
        if (tag === 'em' || tag === 'i') return '*' + text + '*';
        if (tag === 'code') return '\\u0060' + child.textContent + '\\u0060';
        if (tag === 'br') return '';
        if (tag === 'a') return '[' + text + '](' + child.getAttribute('href') + ')';
        return text;
      }).join('').trim();
    }
  </script>
</body>
</html>`;
}

function extractFrontmatter(markdown) {
  const blocks = parse(markdown);
  if (blocks.length && blocks[0].type === 'frontmatter') {
    return blocks[0].raw;
  }
  return '';
}

module.exports = { renderPreview, renderWysiwygEditor };
