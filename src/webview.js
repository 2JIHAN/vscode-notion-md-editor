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
    .slash-menu {
      background: var(--nme-bg-auto);
      border: 1px solid var(--nme-border-auto);
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      max-height: 280px;
      max-width: 320px;
      min-width: 220px;
      overflow-y: auto;
      padding: 6px;
      position: absolute;
      z-index: 1000;
    }
    .slash-menu.hidden { display: none; }
    .slash-menu .slash-item {
      align-items: center;
      border-radius: 4px;
      color: var(--nme-fg-auto);
      cursor: pointer;
      display: flex;
      font-size: 13px;
      gap: 8px;
      padding: 6px 10px;
    }
    .slash-menu .slash-item .slash-icon {
      color: var(--nme-muted-auto);
      flex-shrink: 0;
      font-size: 14px;
      width: 18px;
    }
    .slash-menu .slash-item.active,
    .slash-menu .slash-item:hover {
      background: var(--nme-button-hover-auto);
    }
    .slash-menu .slash-empty {
      color: var(--nme-muted-auto);
      font-size: 12px;
      padding: 8px 10px;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <span class="spacer"></span>
    <span class="status" id="status">Saved</span>
    <button id="themeToggle" title="Toggle theme">Auto</button>
  </div>
  <main id="editor" contenteditable="true" spellcheck="true">${body}</main>
  <div id="slashMenu" class="slash-menu hidden" role="listbox" aria-label="블록 삽입"></div>
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

    // Slash menu state. null 일 때 닫힘.
    // { node, offset, filter, index, items, block }
    let slashState = null;
    const slashMenu = document.getElementById('slashMenu');

    editor.addEventListener('keydown', handleKeyDown);
    editor.addEventListener('input', () => {
      if (slashState) {
        updateSlashFilter();
      } else {
        detectSlashTrigger();
      }
      runAutoformat();
      scheduleUpdate();
    });
    document.addEventListener('mousedown', (event) => {
      if (slashState && !slashMenu.contains(event.target)) {
        closeSlashMenu();
      }
    });
    slashMenu.addEventListener('mousedown', (event) => {
      const item = event.target.closest('.slash-item');
      if (!item) return;
      event.preventDefault();
      const id = item.dataset.id;
      const chosen = SLASH_ITEMS.find(it => it.id === id);
      if (chosen) selectSlashItem(chosen);
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
      // 슬래시 메뉴가 열려 있을 때: 방향키 / Enter / Esc 가로채기
      if (slashState && !event.isComposing) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          moveSlashIndex(1);
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          moveSlashIndex(-1);
          return;
        }
        if (event.key === 'Enter') {
          const filtered = filteredSlashItems();
          if (filtered.length > 0) {
            event.preventDefault();
            selectSlashItem(filtered[slashState.index]);
            return;
          }
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          closeSlashMenu();
          return;
        }
      }
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
      if (mod && event.shiftKey && (event.key === 'S' || event.key === 's')) {
        event.preventDefault();
        document.execCommand('strikeThrough');
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

    function insertCalloutKind(kindKey) {
      const kind = callouts[kindKey];
      if (!kind) return;
      const html = '<div class="callout ' + kind.color + '" data-icon="' + kind.icon + '" data-color="' + kind.color + '"><div class="callout-icon">' + kind.icon + '</div><div class="callout-content"><p><strong>' + kind.title + '</strong></p><p><br></p></div></div>';
      document.execCommand('insertHTML', false, html);
    }

    // ─── 슬래시 메뉴 ──────────────────────────────────────────────────────
    const SLASH_ITEMS = [
      { id: 'h1', label: 'H1 제목', icon: 'H1', keywords: 'h1 heading 제목 큰', action: (block) => replaceBlockWithEmpty(block, 'h1') },
      { id: 'h2', label: 'H2 제목', icon: 'H2', keywords: 'h2 heading 제목 중간', action: (block) => replaceBlockWithEmpty(block, 'h2') },
      { id: 'h3', label: 'H3 제목', icon: 'H3', keywords: 'h3 heading 제목 작은', action: (block) => replaceBlockWithEmpty(block, 'h3') },
      { id: 'ul', label: '불릿 리스트', icon: '•', keywords: 'bullet ul list 글머리 리스트', action: (block) => replaceBlockWithList(block, false) },
      { id: 'ol', label: '번호 리스트', icon: '1.', keywords: 'number ordered ol 번호 리스트', action: (block) => replaceBlockWithList(block, true) },
      { id: 'todo', label: '할 일 체크박스', icon: '☑', keywords: 'todo checkbox check 체크 할일', action: (block) => replaceBlockWithTodo(block) },
      { id: 'quote', label: '인용', icon: '"', keywords: 'quote blockquote 인용', action: (block) => replaceBlockWithEmpty(block, 'blockquote') },
      { id: 'code', label: '코드 블록', icon: '&lt;/&gt;', keywords: 'code pre 코드 블록', action: (block) => replaceBlockWithCode(block) },
      { id: 'divider', label: '구분선', icon: '—', keywords: 'divider hr 구분선', action: (block) => replaceBlockWithDivider(block) },
      { id: 'toggle', label: '토글', icon: '▸', keywords: 'toggle details 토글', action: (block) => replaceBlockWithToggle(block) },
      { id: 'callout-success', label: '✅ 콜아웃 - 성공', icon: '✅', keywords: 'callout success 콜아웃 성공', action: (block) => replaceBlockWithCallout(block, 'success') },
      { id: 'callout-warning', label: '⚠️ 콜아웃 - 주의', icon: '⚠️', keywords: 'callout warning 콜아웃 주의', action: (block) => replaceBlockWithCallout(block, 'warning') },
      { id: 'callout-info', label: '💡 콜아웃 - 정보', icon: '💡', keywords: 'callout info 콜아웃 정보', action: (block) => replaceBlockWithCallout(block, 'info') }
    ];

    function detectSlashTrigger() {
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      if (!range.collapsed) return;
      const node = range.startContainer;
      if (node.nodeType !== Node.TEXT_NODE) return;
      const offset = range.startOffset;
      if (offset === 0) return;
      if (node.textContent[offset - 1] !== '/') return;
      if (getAncestor(node, 'CODE') || getAncestor(node, 'PRE')) return;
      // 직전 글자가 공백/줄시작이어야 함 — 중간에서 우연히 / 친 경우 트리거 안되게
      if (offset >= 2) {
        const ch = node.textContent[offset - 2];
        if (ch && !/[\\s]/.test(ch)) return;
      }
      const block = getBlockContainer(node);
      if (!block || block === editor) return;
      openSlashMenu(node, offset - 1, block);
    }

    function openSlashMenu(node, offset, block) {
      slashState = { node: node, offset: offset, filter: '', index: 0, block: block };
      renderSlashMenu();
    }

    function closeSlashMenu() {
      slashState = null;
      slashMenu.classList.add('hidden');
    }

    function filteredSlashItems() {
      if (!slashState) return [];
      const f = slashState.filter.toLowerCase();
      if (!f) return SLASH_ITEMS;
      return SLASH_ITEMS.filter((item) =>
        item.label.toLowerCase().includes(f) || item.keywords.toLowerCase().includes(f)
      );
    }

    function moveSlashIndex(delta) {
      if (!slashState) return;
      const list = filteredSlashItems();
      if (list.length === 0) return;
      slashState.index = (slashState.index + delta + list.length) % list.length;
      renderSlashMenu();
    }

    function updateSlashFilter() {
      if (!slashState) return;
      const node = slashState.node;
      // 노드가 사라졌거나 위치가 의심스러우면 닫는다.
      if (!node || !document.contains(node)) {
        closeSlashMenu();
        return;
      }
      const sel = window.getSelection();
      if (!sel.rangeCount) {
        closeSlashMenu();
        return;
      }
      const range = sel.getRangeAt(0);
      const cursorOffset = (range.startContainer === node) ? range.startOffset : null;
      if (cursorOffset === null || cursorOffset < slashState.offset + 1) {
        closeSlashMenu();
        return;
      }
      // / 다음부터 커서까지의 텍스트가 필터
      const fullText = node.textContent;
      // / 위치 확인 - 사라졌으면 닫기
      if (fullText[slashState.offset] !== '/') {
        closeSlashMenu();
        return;
      }
      slashState.filter = fullText.slice(slashState.offset + 1, cursorOffset);
      // 필터에 공백 들어오면 일반 텍스트로 간주하고 닫는다.
      if (/\\s/.test(slashState.filter)) {
        closeSlashMenu();
        return;
      }
      slashState.index = 0;
      renderSlashMenu();
    }

    function renderSlashMenu() {
      if (!slashState) return;
      const items = filteredSlashItems();
      if (items.length === 0) {
        slashMenu.innerHTML = '<div class="slash-empty">일치하는 블록 없음</div>';
      } else {
        slashMenu.innerHTML = items.map((item, i) => {
          const cls = 'slash-item' + (i === slashState.index ? ' active' : '');
          return '<div class="' + cls + '" role="option" data-id="' + item.id + '"><span class="slash-icon">' + item.icon + '</span><span>' + item.label + '</span></div>';
        }).join('');
      }
      positionSlashMenuAtCaret();
      slashMenu.classList.remove('hidden');
    }

    function positionSlashMenuAtCaret() {
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      const range = sel.getRangeAt(0).cloneRange();
      range.collapse(true);
      const rect = range.getBoundingClientRect();
      const fallbackRect = slashState.block.getBoundingClientRect();
      const top = (rect.top || fallbackRect.top) + (rect.height || 20) + window.scrollY + 4;
      const left = (rect.left || fallbackRect.left) + window.scrollX;
      slashMenu.style.top = top + 'px';
      slashMenu.style.left = left + 'px';
    }

    function selectSlashItem(item) {
      if (!slashState || !item) return;
      const { node, offset, block } = slashState;
      // / + filter 텍스트 제거
      const sel = window.getSelection();
      const cursorOffset = sel.rangeCount && sel.getRangeAt(0).startContainer === node
        ? sel.getRangeAt(0).startOffset : node.textContent.length;
      node.textContent = node.textContent.slice(0, offset) + node.textContent.slice(cursorOffset);
      // 커서를 / 자리에 복원
      const r = document.createRange();
      r.setStart(node, offset);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
      closeSlashMenu();
      // 액션 수행
      item.action(block);
      scheduleUpdate();
    }

    function isBlockEffectivelyEmpty(block) {
      const text = block.textContent.replace(/\\u200b/g, '').trim();
      return text === '';
    }

    function replaceOrInsert(block, newEl) {
      if (isBlockEffectivelyEmpty(block)) {
        block.replaceWith(newEl);
      } else {
        block.parentNode.insertBefore(newEl, block.nextSibling);
      }
    }

    function placeCursorIn(target) {
      const sel = window.getSelection();
      const r = document.createRange();
      r.setStart(target, 0);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
    }

    function replaceBlockWithEmpty(block, tagName) {
      const el = document.createElement(tagName);
      el.appendChild(document.createElement('br'));
      replaceOrInsert(block, el);
      placeCursorIn(el);
    }

    function replaceBlockWithList(block, ordered) {
      const wrap = document.createElement(ordered ? 'ol' : 'ul');
      const li = document.createElement('li');
      li.appendChild(document.createElement('br'));
      wrap.appendChild(li);
      replaceOrInsert(block, wrap);
      placeCursorIn(li);
    }

    function replaceBlockWithTodo(block) {
      const ul = document.createElement('ul');
      ul.className = 'todo-list';
      const li = document.createElement('li');
      li.className = 'todo-item';
      li.setAttribute('data-checked', 'false');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.contentEditable = 'false';
      const span = document.createElement('span');
      span.className = 'todo-text';
      span.appendChild(document.createElement('br'));
      li.appendChild(cb);
      li.appendChild(span);
      ul.appendChild(li);
      replaceOrInsert(block, ul);
      placeCursorIn(span);
    }

    function replaceBlockWithCode(block) {
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.textContent = '';
      pre.appendChild(code);
      replaceOrInsert(block, pre);
      placeCursorIn(code);
    }

    function replaceBlockWithDivider(block) {
      const hr = document.createElement('hr');
      const newP = document.createElement('p');
      newP.appendChild(document.createElement('br'));
      replaceOrInsert(block, hr);
      hr.parentNode.insertBefore(newP, hr.nextSibling);
      placeCursorIn(newP);
    }

    function replaceBlockWithToggle(block) {
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
      replaceOrInsert(block, det);
      const sel = window.getSelection();
      const r = document.createRange();
      r.selectNodeContents(summary);
      sel.removeAllRanges();
      sel.addRange(r);
    }

    function replaceBlockWithCallout(block, kindKey) {
      const kind = callouts[kindKey];
      if (!kind) return;
      const wrapDiv = document.createElement('div');
      wrapDiv.className = 'callout ' + kind.color;
      wrapDiv.dataset.icon = kind.icon;
      wrapDiv.dataset.color = kind.color;
      const iconDiv = document.createElement('div');
      iconDiv.className = 'callout-icon';
      iconDiv.textContent = kind.icon;
      const contentDiv = document.createElement('div');
      contentDiv.className = 'callout-content';
      const titleP = document.createElement('p');
      const titleStrong = document.createElement('strong');
      titleStrong.textContent = kind.title;
      titleP.appendChild(titleStrong);
      const bodyP = document.createElement('p');
      bodyP.appendChild(document.createElement('br'));
      contentDiv.appendChild(titleP);
      contentDiv.appendChild(bodyP);
      wrapDiv.appendChild(iconDiv);
      wrapDiv.appendChild(contentDiv);
      replaceOrInsert(block, wrapDiv);
      placeCursorIn(bodyP);
    }
    // ─── 슬래시 메뉴 끝 ────────────────────────────────────────────────────

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
          // contenteditable이 끝 공백을 \\u00a0(nbsp)로 치환하므로 정규화한다.
          const cleanText = blockText.replace(/\\u200b/g, '').replace(/\\u00a0/g, ' ');
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

      // 인라인 코드 \`...\` (기존 동작)
      if (tryInlineReplace(node, head, tail, /(^|[^\`])\`([^\`\\n]+)\`$/, (inner) => {
        const code = document.createElement('code');
        code.textContent = inner;
        return code;
      })) return;

      // bold **...**
      if (tryInlineReplace(node, head, tail, /(^|[^*])\\*\\*([^*\\n]+?)\\*\\*$/, (inner) => {
        const el = document.createElement('strong');
        el.textContent = inner;
        return el;
      })) return;

      // italic *...* (앞이 * 가 아니고 뒤에도 * 가 오지 않을 때)
      if (tryInlineReplace(node, head, tail, /(^|[^*])\\*([^*\\n]+?)\\*(?!\\*)$/, (inner) => {
        const el = document.createElement('em');
        el.textContent = inner;
        return el;
      })) return;

      // italic _..._ (단어 중간 underscore 제외)
      if (tryInlineReplace(node, head, tail, /(^|[^_\\w])_([^_\\n]+?)_(?!\\w)$/, (inner) => {
        const el = document.createElement('em');
        el.textContent = inner;
        return el;
      })) return;

      // strikethrough ~~...~~
      if (tryInlineReplace(node, head, tail, /(^|[^~])~~([^~\\n]+?)~~$/, (inner) => {
        const el = document.createElement('del');
        el.textContent = inner;
        return el;
      })) return;

      // strikethrough ~...~ (단일 ~ ~, 노션 호환)
      if (tryInlineReplace(node, head, tail, /(^|[^~])~([^~\\n]+?)~(?!~)$/, (inner) => {
        const el = document.createElement('del');
        el.textContent = inner;
        return el;
      })) return;

      // link [text](url) — 이미지 ![](...) 는 제외
      const linkMatch = /(^|[^!])\\[([^\\]\\n]+)\\]\\(([^)\\n]+)\\)$/.exec(head);
      if (linkMatch) {
        const matched = linkMatch[0];
        const prefix = linkMatch[1] || '';
        const linkText = linkMatch[2];
        const url = linkMatch[3];
        const before = head.slice(0, head.length - matched.length) + prefix;
        const parent = node.parentNode;
        const beforeNode = document.createTextNode(before);
        const afterNode = document.createTextNode(tail);
        const a = document.createElement('a');
        a.setAttribute('href', url);
        a.textContent = linkText;
        parent.insertBefore(beforeNode, node);
        parent.insertBefore(a, node);
        parent.insertBefore(afterNode, node);
        parent.removeChild(node);
        const r = document.createRange();
        r.setStart(afterNode, 0);
        r.collapse(true);
        selection.removeAllRanges();
        selection.addRange(r);
        return;
      }
    }

    function tryInlineReplace(node, head, tail, regex, makeElement) {
      const m = regex.exec(head);
      if (!m) return false;
      const matched = m[0];
      const prefix = m[1] || '';
      const inner = m[2];
      const before = head.slice(0, head.length - matched.length) + prefix;
      const parent = node.parentNode;
      const beforeNode = document.createTextNode(before);
      const afterNode = document.createTextNode(tail);
      const el = makeElement(inner);
      parent.insertBefore(beforeNode, node);
      parent.insertBefore(el, node);
      parent.insertBefore(afterNode, node);
      parent.removeChild(node);
      const sel = window.getSelection();
      const r = document.createRange();
      r.setStart(afterNode, 0);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
      return true;
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
