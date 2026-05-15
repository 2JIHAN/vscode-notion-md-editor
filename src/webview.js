/**
 * Preview, WYSIWYG webview의 HTML 템플릿.
 *
 * markdown 모듈로 본문을 HTML로 렌더링한 뒤 webview용 wrapper에 삽입한다.
 * webview script는 browser context에서 실행되므로, 공유 상수는 JSON으로
 * 직렬화해 inline data로 주입한다.
 *
 * 클라이언트 스크립트가 처리하는 기능
 *   - light, dark, auto 테마 토글 (vscode state 저장)
 *   - Cmd+Z, Cmd+Shift+Z undo 위임 (contenteditable native)
 *   - Cmd+E inline code 토글
 *   - 백틱 한 쌍을 inline code로 자동 변환
 *   - 세 백틱 + Enter를 fenced code block으로 자동 변환
 */

const { renderHtml, parse } = require('./markdown');
const { CALLOUTS } = require('./callouts');

const COMMON_STYLE = `
  :root {
    --nme-bg-auto: #ffffff;
    --nme-fg-auto: #37352f;
    --nme-quote-border-auto: rgba(55, 53, 47, 0.2);
    --nme-quote-fg-auto: #5f5e5b;
    --nme-code-bg-auto: rgba(135, 131, 120, 0.15);
    --nme-code-fg-auto: #EB5757;
    --nme-pre-bg-auto: rgba(247, 246, 243, 1);
    --nme-pre-fg-auto: #37352f;
    --nme-border-auto: rgba(55, 53, 47, 0.12);
    --nme-muted-auto: rgba(55, 53, 47, 0.5);
    --nme-button-bg-auto: rgba(55, 53, 47, 0.08);
    --nme-button-fg-auto: #37352f;
    --nme-button-hover-auto: rgba(55, 53, 47, 0.16);
    --nme-font-sans: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Apple SD Gothic Neo", "Malgun Gothic", "Segoe UI", Roboto, sans-serif;
    --nme-font-mono: Menlo, "D2Coding", ui-monospace, SFMono-Regular, Monaco, Consolas, "Courier New", monospace;
  }
  [data-theme="light"] {
    --nme-bg-auto: #ffffff;
    --nme-fg-auto: #37352f;
    --nme-quote-border-auto: rgba(55, 53, 47, 0.2);
    --nme-quote-fg-auto: #5f5e5b;
    --nme-code-bg-auto: rgba(135, 131, 120, 0.15);
    --nme-code-fg-auto: #EB5757;
    --nme-pre-bg-auto: rgba(247, 246, 243, 1);
    --nme-pre-fg-auto: #37352f;
    --nme-border-auto: rgba(55, 53, 47, 0.12);
    --nme-muted-auto: rgba(55, 53, 47, 0.5);
    --nme-button-bg-auto: rgba(55, 53, 47, 0.08);
    --nme-button-fg-auto: #37352f;
    --nme-button-hover-auto: rgba(55, 53, 47, 0.16);
  }
  [data-theme="dark"] {
    --nme-bg-auto: #191919;
    --nme-fg-auto: #e6e6e6;
    --nme-quote-border-auto: rgba(255, 255, 255, 0.2);
    --nme-quote-fg-auto: #cfcfcf;
    --nme-code-bg-auto: rgba(135, 131, 120, 0.25);
    --nme-code-fg-auto: #FF8B8B;
    --nme-pre-bg-auto: rgba(255, 255, 255, 0.06);
    --nme-pre-fg-auto: #e6e6e6;
    --nme-border-auto: rgba(255, 255, 255, 0.1);
    --nme-muted-auto: rgba(255, 255, 255, 0.45);
    --nme-button-bg-auto: rgba(255, 255, 255, 0.06);
    --nme-button-fg-auto: #e6e6e6;
    --nme-button-hover-auto: rgba(255, 255, 255, 0.12);
  }
  [data-theme="auto"] {
    --nme-bg-auto: var(--vscode-editor-background);
    --nme-fg-auto: var(--vscode-editor-foreground);
    --nme-quote-border-auto: var(--vscode-textBlockQuote-border);
    --nme-quote-fg-auto: var(--vscode-textBlockQuote-foreground);
    --nme-code-bg-auto: var(--vscode-textCodeBlock-background);
    --nme-code-fg-auto: inherit;
    --nme-pre-bg-auto: var(--vscode-textCodeBlock-background);
    --nme-pre-fg-auto: var(--vscode-editor-foreground);
    --nme-border-auto: var(--vscode-editorWidget-border);
    --nme-muted-auto: var(--vscode-descriptionForeground);
    --nme-button-bg-auto: var(--vscode-button-secondaryBackground);
    --nme-button-fg-auto: var(--vscode-button-secondaryForeground);
    --nme-button-hover-auto: var(--vscode-button-secondaryHoverBackground);
  }
  body {
    color: var(--nme-fg-auto);
    background: var(--nme-bg-auto);
    font-family: var(--nme-font-sans);
    line-height: 1.65;
  }
  h1, h2, h3 { line-height: 1.25; }
  code {
    background: var(--nme-code-bg-auto);
    color: var(--nme-code-fg-auto);
    border-radius: 4px;
    padding: 0.1em 0.35em;
    font-family: var(--nme-font-mono);
    font-size: 0.92em;
  }
  pre {
    background: var(--nme-pre-bg-auto);
    color: var(--nme-pre-fg-auto);
    border-radius: 8px;
    overflow: auto;
    padding: 14px 16px;
    font-family: var(--nme-font-mono);
    white-space: pre-wrap;
  }
  pre code {
    background: transparent;
    color: var(--nme-pre-fg-auto);
    padding: 0;
    font-size: 1em;
  }
  blockquote {
    border-left: 4px solid var(--nme-quote-border-auto);
    color: var(--nme-quote-fg-auto);
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
  hr {
    border: none;
    border-top: 1px solid var(--nme-border-auto);
    margin: 1.5em 0;
  }
  ul.todo-list {
    list-style: none;
    padding-left: 0;
  }
  ul.todo-list > li.todo-item {
    align-items: flex-start;
    display: flex;
    gap: 8px;
    margin: 4px 0;
  }
  ul.todo-list > li.todo-item > input[type="checkbox"] {
    cursor: pointer;
    margin-top: 6px;
    flex-shrink: 0;
  }
  ul.todo-list > li.todo-item.checked > .todo-text {
    color: var(--nme-muted-auto);
    text-decoration: line-through;
  }
  details.toggle {
    margin: 0.5em 0;
    padding: 4px 0 4px 4px;
  }
  details.toggle > summary {
    cursor: pointer;
    list-style: revert;
    padding: 2px 0;
  }
  details.toggle > .toggle-content {
    margin: 4px 0 4px 18px;
    outline: none;
  }
  del, s {
    color: var(--nme-muted-auto);
    text-decoration: line-through;
  }
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
      background: var(--nme-bg-auto);
      border-bottom: 1px solid var(--nme-border-auto);
      display: flex;
      gap: 6px;
      padding: 10px 14px;
      position: sticky;
      top: 0;
      z-index: 2;
    }
    button, select {
      background: var(--nme-button-bg-auto);
      border: 1px solid transparent;
      border-radius: 6px;
      color: var(--nme-button-fg-auto);
      cursor: pointer;
      font: inherit;
      padding: 5px 9px;
    }
    button:hover, select:hover { background: var(--nme-button-hover-auto); }
    .toolbar .spacer { flex: 1; }
    .status { color: var(--nme-muted-auto); margin-right: 10px; font-size: 12px; }
    #themeToggle { min-width: 70px; }
    #editor {
      line-height: 1.65;
      margin: 0 auto;
      max-width: 860px;
      min-height: calc(100vh - 54px);
      outline: none;
      padding: 32px 28px 64px;
    }
    #editor:empty::before {
      color: var(--nme-muted-auto);
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
    <span class="spacer"></span>
    <span class="status" id="status">Saved</span>
    <button id="themeToggle" title="Toggle theme">Auto</button>
  </div>
  <main id="editor" contenteditable="true" spellcheck="true">${body}</main>
  <script>
    const vscode = acquireVsCodeApi();
    const editor = document.getElementById('editor');
    const status = document.getElementById('status');
    const themeToggle = document.getElementById('themeToggle');
    const callouts = ${calloutsJson};
    const frontmatter = ${frontmatterJson};
    const THEMES = ['light', 'dark', 'auto'];
    const THEME_LABELS = { light: 'Light', dark: 'Dark', auto: 'Auto' };
    let timer;
    let themeIndex = 0;

    const restored = vscode.getState();
    if (restored && typeof restored.theme === 'string') {
      const found = THEMES.indexOf(restored.theme);
      if (found >= 0) themeIndex = found;
    }
    applyTheme();

    themeToggle.addEventListener('click', () => {
      themeIndex = (themeIndex + 1) % THEMES.length;
      applyTheme();
      vscode.setState({ theme: THEMES[themeIndex] });
    });

    document.querySelector('.toolbar').addEventListener('click', (event) => {
      const button = event.target.closest('button[data-command]');
      if (!button) return;
      runCommand(button.dataset.command);
    });

    editor.addEventListener('keydown', handleKeyDown);
    editor.addEventListener('input', () => {
      runAutoformat();
      scheduleUpdate();
    });
    editor.addEventListener('paste', (event) => {
      event.preventDefault();
      const text = event.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
    });

    function applyTheme() {
      const theme = THEMES[themeIndex];
      themeToggle.textContent = THEME_LABELS[theme];
      document.documentElement.setAttribute('data-theme', theme);
    }

    function handleKeyDown(event) {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && !event.shiftKey && event.key === 'z') {
        event.preventDefault();
        document.execCommand('undo');
        scheduleUpdate();
        return;
      }
      if (mod && (event.key === 'Z' || (event.shiftKey && event.key === 'z'))) {
        event.preventDefault();
        document.execCommand('redo');
        scheduleUpdate();
        return;
      }
      if (mod && !event.shiftKey && event.key === 'e') {
        event.preventDefault();
        toggleInlineCode();
        scheduleUpdate();
        return;
      }
      if (mod && !event.shiftKey && event.key === 'b') {
        event.preventDefault();
        document.execCommand('bold');
        scheduleUpdate();
        return;
      }
      if (mod && !event.shiftKey && event.key === 'i') {
        event.preventDefault();
        document.execCommand('italic');
        scheduleUpdate();
        return;
      }
      if (event.key === 'Backspace') {
        const anchor = getSelectionAnchor();
        const calloutContent = getCalloutContent(anchor);
        if (calloutContent && isCalloutBodyEmpty(calloutContent) && isCursorAtStart(calloutContent)) {
          event.preventDefault();
          convertCalloutToParagraph(calloutContent.closest('.callout'));
          scheduleUpdate();
          return;
        }
      }
      if (event.key === 'Enter') {
        const anchor = getSelectionAnchor();
        const pre = getAncestor(anchor, 'PRE');
        if (pre) {
          event.preventDefault();
          document.execCommand('insertText', false, '\\n');
          scheduleUpdate();
          return;
        }
        const inlineCode = getAncestor(anchor, 'CODE');
        if (inlineCode) {
          event.preventDefault();
          exitInlineCodeWithNewParagraph(inlineCode);
          scheduleUpdate();
          return;
        }
      }
    }

    function exitInlineCodeWithNewParagraph(codeEl) {
      const block = getBlockContainer(codeEl);
      if (!block || block === editor) return;
      const newP = document.createElement('p');
      newP.appendChild(document.createElement('br'));
      block.parentNode.insertBefore(newP, block.nextSibling);
      const newRange = document.createRange();
      newRange.setStart(newP, 0);
      newRange.collapse(true);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(newRange);
    }

    function getSelectionAnchor() {
      const selection = window.getSelection();
      if (!selection.rangeCount) return null;
      return selection.getRangeAt(0).startContainer;
    }

    function getCalloutContent(node) {
      let current = node;
      while (current && current !== editor) {
        if (current.nodeType === Node.ELEMENT_NODE && current.classList && current.classList.contains('callout-content')) {
          return current;
        }
        current = current.parentNode;
      }
      return null;
    }

    function stripZwsAndTrim(str) {
      return str.replace(/​/g, '').trim();
    }

    function isCalloutBodyEmpty(calloutContent) {
      return stripZwsAndTrim(calloutContent.textContent) === '';
    }

    function isCursorAtStart(calloutContent) {
      const selection = window.getSelection();
      if (!selection.rangeCount) return false;
      const range = selection.getRangeAt(0);
      if (!range.collapsed) return false;
      if (range.startOffset !== 0) return false;
      // Walk from the cursor's startContainer up to calloutContent, verifying
      // that every node along the path is the first non-whitespace-text child
      // of its parent. This ensures the cursor is truly at the very beginning
      // of the callout body, not merely at offset 0 of some inner node.
      let node = range.startContainer;
      while (node && node !== calloutContent) {
        const parent = node.parentNode;
        if (!parent) return false;
        // Find the first child that is not a pure-whitespace text node
        let firstMeaningful = null;
        for (let i = 0; i < parent.childNodes.length; i++) {
          const child = parent.childNodes[i];
          if (child.nodeType === Node.TEXT_NODE && child.textContent.trim() === '') continue;
          firstMeaningful = child;
          break;
        }
        if (node !== firstMeaningful) return false;
        node = parent;
      }
      return true;
    }

    function convertCalloutToParagraph(calloutEl) {
      if (!calloutEl) return;
      const newP = document.createElement('p');
      newP.appendChild(document.createElement('br'));
      calloutEl.parentNode.insertBefore(newP, calloutEl);
      calloutEl.remove();
      const newRange = document.createRange();
      newRange.setStart(newP, 0);
      newRange.collapse(true);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(newRange);
    }

    function runCommand(command) {
      editor.focus();
      if (command === 'h1') document.execCommand('formatBlock', false, 'h1');
      if (command === 'h2') document.execCommand('formatBlock', false, 'h2');
      if (command === 'bold') document.execCommand('bold');
      if (command === 'code') toggleInlineCode();
      if (command === 'callout') insertCallout();
      scheduleUpdate();
    }

    function insertCallout() {
      const kind = callouts[document.getElementById('calloutKind').value];
      const html = '<div class="callout ' + kind.color + '" data-icon="' + kind.icon + '" data-color="' + kind.color + '"><div class="callout-icon">' + kind.icon + '</div><div class="callout-content"><p><strong>' + kind.title + '</strong></p><p><br></p></div></div>';
      document.execCommand('insertHTML', false, html);
    }

    function toggleInlineCode() {
      const selection = window.getSelection();
      if (!selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      const codeAncestor = getAncestor(range.startContainer, 'CODE');
      if (codeAncestor) {
        const text = codeAncestor.textContent;
        const parent = codeAncestor.parentNode;
        const textNode = document.createTextNode(text);
        parent.replaceChild(textNode, codeAncestor);
        const newRange = document.createRange();
        newRange.setStart(textNode, text.length);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
        return;
      }
      if (range.collapsed) {
        const code = document.createElement('code');
        code.appendChild(document.createTextNode('\\u200b'));
        range.insertNode(code);
        const newRange = document.createRange();
        newRange.setStart(code.firstChild, 1);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
        return;
      }
      const text = range.toString();
      range.deleteContents();
      const code = document.createElement('code');
      code.textContent = text;
      range.insertNode(code);
      const newRange = document.createRange();
      newRange.setStartAfter(code);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }

    function getAncestor(node, tag) {
      let current = node;
      while (current && current !== editor) {
        if (current.nodeType === Node.ELEMENT_NODE && current.tagName === tag) {
          return current;
        }
        current = current.parentNode;
      }
      return null;
    }

    function runAutoformat() {
      const selection = window.getSelection();
      if (!selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      if (!range.collapsed) return;
      const node = range.startContainer;
      if (getAncestor(node, 'CODE') || getAncestor(node, 'PRE')) return;

      const block = getBlockContainer(node);
      if (block && block !== editor) {
        const tag = block.tagName.toLowerCase();
        if (tag === 'p' || tag === 'div') {
          const blockText = block.textContent;
          if (blockText.trim() === '\\u0060\\u0060\\u0060') {
            const pre = document.createElement('pre');
            const code = document.createElement('code');
            code.textContent = '';
            pre.appendChild(code);
            block.replaceWith(pre);
            const newRange = document.createRange();
            newRange.setStart(code, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            return;
          }
          if (/^-{3,}$/.test(blockText.trim())) {
            const hr = document.createElement('hr');
            const newP = document.createElement('p');
            newP.appendChild(document.createElement('br'));
            block.replaceWith(hr);
            hr.parentNode.insertBefore(newP, hr.nextSibling);
            const newRange = document.createRange();
            newRange.setStart(newP, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            return;
          }

          // 라인 첫머리 + space 트리거 (heading / list / todo / blockquote / toggle)
          const cleanText = blockText.replace(/\\u200b/g, '');
          const headingMatch = /^(#{1,6}) $/.exec(cleanText);
          if (headingMatch) {
            const level = headingMatch[1].length;
            const h = document.createElement('h' + level);
            h.appendChild(document.createElement('br'));
            block.replaceWith(h);
            const newRange = document.createRange();
            newRange.setStart(h, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            return;
          }
          const todoMatch = /^\\[([ xX]?)\\] $/.exec(cleanText);
          if (todoMatch) {
            const checked = todoMatch[1].toLowerCase() === 'x';
            const ul = document.createElement('ul');
            ul.className = 'todo-list';
            const li = document.createElement('li');
            li.className = checked ? 'todo-item checked' : 'todo-item';
            li.setAttribute('data-checked', String(checked));
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.contentEditable = 'false';
            if (checked) cb.setAttribute('checked', '');
            const span = document.createElement('span');
            span.className = 'todo-text';
            span.appendChild(document.createElement('br'));
            li.appendChild(cb);
            li.appendChild(span);
            ul.appendChild(li);
            block.replaceWith(ul);
            const newRange = document.createRange();
            newRange.setStart(span, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            return;
          }
          if (/^[-*+] $/.test(cleanText)) {
            const ul = document.createElement('ul');
            const li = document.createElement('li');
            li.appendChild(document.createElement('br'));
            ul.appendChild(li);
            block.replaceWith(ul);
            const newRange = document.createRange();
            newRange.setStart(li, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            return;
          }
          const olMatch = /^(\\d+)\\. $/.exec(cleanText);
          if (olMatch) {
            const ol = document.createElement('ol');
            const startNum = parseInt(olMatch[1], 10);
            if (startNum !== 1) ol.setAttribute('start', String(startNum));
            const li = document.createElement('li');
            li.appendChild(document.createElement('br'));
            ol.appendChild(li);
            block.replaceWith(ol);
            const newRange = document.createRange();
            newRange.setStart(li, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            return;
          }
          if (cleanText === '" ') {
            const bq = document.createElement('blockquote');
            bq.appendChild(document.createElement('br'));
            block.replaceWith(bq);
            const newRange = document.createRange();
            newRange.setStart(bq, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            return;
          }
          if (cleanText === '> ') {
            const det = document.createElement('details');
            det.className = 'toggle';
            det.open = true;
            const summary = document.createElement('summary');
            summary.textContent = '토글';
            const content = document.createElement('div');
            content.className = 'toggle-content';
            const p = document.createElement('p');
            p.appendChild(document.createElement('br'));
            content.appendChild(p);
            det.appendChild(summary);
            det.appendChild(content);
            block.replaceWith(det);
            // 사용자가 즉시 요약을 덮어쓸 수 있도록 전체 선택
            const newRange = document.createRange();
            newRange.selectNodeContents(summary);
            selection.removeAllRanges();
            selection.addRange(newRange);
            return;
          }
        }
      }

      if (node.nodeType !== Node.TEXT_NODE) return;
      const offset = range.startOffset;
      const text = node.textContent;
      const head = text.slice(0, offset);
      const tail = text.slice(offset);

      const inlineMatch = /(^|[^\`])\`([^\`\\n]+)\`$/.exec(head);
      if (inlineMatch) {
        const matched = inlineMatch[0];
        const codeText = inlineMatch[2];
        const before = head.slice(0, head.length - matched.length) + inlineMatch[1];
        const parent = node.parentNode;
        const beforeNode = document.createTextNode(before);
        const afterNode = document.createTextNode(tail);
        const code = document.createElement('code');
        code.textContent = codeText;
        parent.insertBefore(beforeNode, node);
        parent.insertBefore(code, node);
        parent.insertBefore(afterNode, node);
        parent.removeChild(node);
        const newRange = document.createRange();
        newRange.setStart(afterNode, 0);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    }

    function getBlockContainer(node) {
      let current = node;
      if (current.nodeType === Node.TEXT_NODE) current = current.parentNode;
      while (current && current !== editor && current.parentNode !== editor) {
        current = current.parentNode;
      }
      return current;
    }

    function scheduleUpdate() {
      status.textContent = 'Editing...';
      clearTimeout(timer);
      timer = setTimeout(() => {
        const body = editorToMarkdown(editor);
        const markdown = frontmatter ? frontmatter + '\\n\\n' + body : body;
        vscode.postMessage({ type: 'update', markdown: markdown });
        status.textContent = 'Saved';
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
      if (tag === 'h4') return '#### ' + inlineMarkdown(node);
      if (tag === 'h5') return '##### ' + inlineMarkdown(node);
      if (tag === 'h6') return '###### ' + inlineMarkdown(node);
      if (tag === 'p' || tag === 'div') {
        if (node.classList.contains('callout')) return calloutToMarkdown(node);
        if (node.classList.contains('toggle-content')) return inlineMarkdown(node).trim();
        return inlineMarkdown(node).trim();
      }
      if (tag === 'blockquote') return inlineMarkdown(node).split('\\n').map(line => '> ' + line).join('\\n');
      if (tag === 'pre') {
        const codeChild = node.querySelector('code');
        const lang = codeChild && codeChild.getAttribute('data-lang') ? codeChild.getAttribute('data-lang') : '';
        const content = (codeChild ? codeChild.textContent : node.textContent).replace(/\\n+$/, '');
        return '\\u0060\\u0060\\u0060' + lang + '\\n' + content + '\\n\\u0060\\u0060\\u0060';
      }
      if (tag === 'hr') return '---';
      if (tag === 'ul') {
        if (node.classList.contains('todo-list')) return todoToMarkdown(node);
        return Array.from(node.children).map(li => '- ' + todoOrInline(li)).join('\\n');
      }
      if (tag === 'ol') return Array.from(node.children).map((li, index) => (index + 1) + '. ' + inlineMarkdown(li)).join('\\n');
      if (tag === 'details') return toggleToMarkdown(node);
      return inlineMarkdown(node).trim();
    }

    function todoOrInline(li) {
      // 일반 ul 안에 todo-item이 섞여 있을 때를 위한 폴백
      if (li.classList && li.classList.contains('todo-item')) {
        const checked = li.getAttribute('data-checked') === 'true' || li.querySelector('input[type="checkbox"]:checked');
        const span = li.querySelector('.todo-text');
        const text = span ? inlineMarkdown(span) : inlineMarkdown(li);
        return '[' + (checked ? 'x' : ' ') + '] ' + text;
      }
      return inlineMarkdown(li);
    }

    function todoToMarkdown(node) {
      return Array.from(node.children).map((li) => {
        const cb = li.querySelector('input[type="checkbox"]');
        const checked = (cb && cb.checked) || li.getAttribute('data-checked') === 'true';
        const span = li.querySelector('.todo-text');
        const text = span ? inlineMarkdown(span) : inlineMarkdown(li);
        return '- [' + (checked ? 'x' : ' ') + '] ' + text;
      }).join('\\n');
    }

    function toggleToMarkdown(node) {
      const summaryEl = node.querySelector(':scope > summary');
      const summary = summaryEl ? inlineMarkdown(summaryEl) : '';
      const contentEl = node.querySelector(':scope > .toggle-content') || node;
      const innerNodes = contentEl === node
        ? Array.from(node.childNodes).filter(child => !(child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() === 'summary'))
        : Array.from(contentEl.childNodes);
      const inner = innerNodes.map(nodeToMarkdown).filter(Boolean).join('\\n\\n').trim();
      const innerPart = inner ? '\\n\\n' + inner + '\\n' : '\\n';
      return '<details>\\n<summary>' + summary + '</summary>' + innerPart + '</details>';
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
        if (child.nodeType === Node.TEXT_NODE) return child.textContent.replace(/\\s+/g, ' ').replace(/\\u200b/g, '');
        if (child.nodeType !== Node.ELEMENT_NODE) return '';
        const tag = child.tagName.toLowerCase();
        const text = inlineMarkdown(child);
        if (tag === 'strong' || tag === 'b') return '**' + text + '**';
        if (tag === 'em' || tag === 'i') return '*' + text + '*';
        if (tag === 'del' || tag === 's' || tag === 'strike') return '~~' + text + '~~';
        if (tag === 'code') return '\\u0060' + child.textContent.replace(/\\u200b/g, '') + '\\u0060';
        if (tag === 'br') return '';
        if (tag === 'a') return '[' + text + '](' + child.getAttribute('href') + ')';
        if (tag === 'input' && child.type === 'checkbox') return '';
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
