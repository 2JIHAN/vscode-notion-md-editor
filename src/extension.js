const vscode = require('vscode');

const CALLOUTS = {
  success: { icon: '✅', color: 'green_bg', title: '성공 기준' },
  warning: { icon: '⚠️', color: 'yellow_bg', title: '주의' },
  info: { icon: '💡', color: 'blue_bg', title: '정보' }
};

let previewPanel;
let calloutDecoration;

function activate(context) {
  calloutDecoration = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    borderWidth: '0 0 0 3px',
    borderStyle: 'solid',
    borderColor: new vscode.ThemeColor('notebook.focusedCellBorder'),
    backgroundColor: new vscode.ThemeColor('editor.wordHighlightBackground'),
    overviewRulerColor: new vscode.ThemeColor('notebook.focusedCellBorder'),
    overviewRulerLane: vscode.OverviewRulerLane.Left
  });

  context.subscriptions.push(calloutDecoration);
  context.subscriptions.push(vscode.window.registerCustomEditorProvider(
    'notionMd.wysiwygEditor',
    new NotionMarkdownEditorProvider(context),
    {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: false
    }
  ));
  context.subscriptions.push(vscode.commands.registerCommand('notionMd.openWysiwyg', openWysiwyg));
  context.subscriptions.push(vscode.commands.registerCommand('notionMd.openPreview', openPreview));
  context.subscriptions.push(vscode.commands.registerCommand('notionMd.insertSuccessCallout', () => insertCallout(CALLOUTS.success)));
  context.subscriptions.push(vscode.commands.registerCommand('notionMd.insertWarningCallout', () => insertCallout(CALLOUTS.warning)));
  context.subscriptions.push(vscode.commands.registerCommand('notionMd.insertInfoCallout', () => insertCallout(CALLOUTS.info)));
  context.subscriptions.push(vscode.commands.registerCommand('notionMd.wrapSelectionInCallout', wrapSelectionInCallout));
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateDecorations));
  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((event) => {
    if (vscode.window.activeTextEditor && event.document === vscode.window.activeTextEditor.document) {
      updateDecorations(vscode.window.activeTextEditor);
      updatePreviewIfNeeded(event.document);
    }
  }));

  updateDecorations(vscode.window.activeTextEditor);
}

function deactivate() {}

async function openWysiwyg() {
  const editor = vscode.window.activeTextEditor;
  if (!isMarkdownEditor(editor)) {
    vscode.window.showInformationMessage('Open a Markdown file first.');
    return;
  }

  await vscode.commands.executeCommand('vscode.openWith', editor.document.uri, 'notionMd.wysiwygEditor');
}

class NotionMarkdownEditorProvider {
  constructor(context) {
    this.context = context;
  }

  async resolveCustomTextEditor(document, webviewPanel) {
    webviewPanel.webview.options = { enableScripts: true };
    webviewPanel.webview.html = renderWysiwygEditor(document.getText());

    const changeDocumentSubscription = webviewPanel.webview.onDidReceiveMessage(async (message) => {
      if (message.type !== 'update') {
        return;
      }

      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
      );
      edit.replace(document.uri, fullRange, message.markdown);
      await vscode.workspace.applyEdit(edit);
    });

    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });
  }
}

async function insertCallout(kind) {
  const editor = vscode.window.activeTextEditor;
  if (!isMarkdownEditor(editor)) {
    return;
  }

  const snippet = new vscode.SnippetString(
    `<callout icon="${kind.icon}" color="${kind.color}">\n**${kind.title}**\n\n$0\n</callout>`
  );
  await editor.insertSnippet(snippet, editor.selection.active);
}

async function wrapSelectionInCallout() {
  const editor = vscode.window.activeTextEditor;
  if (!isMarkdownEditor(editor)) {
    return;
  }

  const picked = await vscode.window.showQuickPick([
    { label: '✅ Success', value: CALLOUTS.success },
    { label: '⚠️ Warning', value: CALLOUTS.warning },
    { label: '💡 Info', value: CALLOUTS.info }
  ], { placeHolder: 'Select Notion callout style' });

  if (!picked) {
    return;
  }

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection) || picked.value.title;
  const replacement = `<callout icon="${picked.value.icon}" color="${picked.value.color}">\n${selectedText}\n</callout>`;

  await editor.edit((editBuilder) => {
    editBuilder.replace(selection, replacement);
  });
}

function openPreview() {
  const editor = vscode.window.activeTextEditor;
  if (!isMarkdownEditor(editor)) {
    vscode.window.showInformationMessage('Open a Markdown file first.');
    return;
  }

  previewPanel = vscode.window.createWebviewPanel(
    'notionMdPreview',
    `Notion Preview: ${editor.document.fileName.split('/').pop()}`,
    vscode.ViewColumn.Beside,
    { enableScripts: false }
  );

  previewPanel.onDidDispose(() => {
    previewPanel = undefined;
  });

  updatePreview(editor.document);
}

function updatePreviewIfNeeded(document) {
  const config = vscode.workspace.getConfiguration('notionMd');
  if (previewPanel && config.get('preview.updateOnType', true)) {
    updatePreview(document);
  }
}

function updatePreview(document) {
  if (!previewPanel) {
    return;
  }

  previewPanel.webview.html = renderPreview(document.getText());
}

function updateDecorations(editor) {
  if (!isMarkdownEditor(editor)) {
    return;
  }

  const text = editor.document.getText();
  const ranges = [];
  const regex = /<callout\b[^>]*>[\s\S]*?<\/callout>/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const start = editor.document.positionAt(match.index);
    const end = editor.document.positionAt(match.index + match[0].length);
    ranges.push(new vscode.Range(start, end));
  }

  editor.setDecorations(calloutDecoration, ranges);
}

function isMarkdownEditor(editor) {
  return editor && editor.document && editor.document.languageId === 'markdown';
}

function renderPreview(markdown) {
  const body = renderBlocks(markdown);

  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
      font-family: var(--vscode-font-family);
      line-height: 1.65;
      padding: 28px;
      max-width: 860px;
      margin: 0 auto;
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
  </style>
</head>
<body>${body}</body>
</html>`;
}

function renderWysiwygEditor(markdown) {
  const body = renderBlocks(markdown);

  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    body {
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
      font-family: var(--vscode-font-family);
      margin: 0;
    }
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
    h1, h2, h3 { line-height: 1.25; margin: 1.25em 0 0.55em; }
    p { margin: 0.7em 0; }
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
    .callout-content { outline: none; }
    .callout-content > :first-child { margin-top: 0; }
    .callout-content > :last-child { margin-bottom: 0; }
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
    const callouts = {
      success: { icon: '✅', color: 'green_bg', title: '성공 기준' },
      warning: { icon: '⚠️', color: 'yellow_bg', title: '주의' },
      info: { icon: '💡', color: 'blue_bg', title: '정보' }
    };
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
        vscode.postMessage({ type: 'update', markdown: editorToMarkdown(editor) });
        status.textContent = 'Saved to VS Code document';
      }, 250);
    }

    function editorToMarkdown(root) {
      return Array.from(root.childNodes).map(nodeToMarkdown).filter(Boolean).join('\n\n').trim() + '\n';
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
      if (tag === 'blockquote') return inlineMarkdown(node).split('\n').map(line => '> ' + line).join('\n');
      if (tag === 'pre') return '\`\`\`\n' + node.textContent.replace(/\n+$/, '') + '\n\`\`\`';
      if (tag === 'ul') return Array.from(node.children).map(li => '- ' + inlineMarkdown(li)).join('\n');
      if (tag === 'ol') return Array.from(node.children).map((li, index) => (index + 1) + '. ' + inlineMarkdown(li)).join('\n');
      return inlineMarkdown(node).trim();
    }

    function calloutToMarkdown(node) {
      const icon = node.dataset.icon || node.querySelector('.callout-icon')?.textContent.trim() || '💡';
      const color = node.dataset.color || Array.from(node.classList).find(name => name.endsWith('_bg')) || 'gray_bg';
      const content = node.querySelector('.callout-content') || node;
      const markdown = Array.from(content.childNodes).map(nodeToMarkdown).filter(Boolean).join('\n\n').trim();
      return '<callout icon="' + icon + '" color="' + color + '">\n' + markdown + '\n</callout>';
    }

    function inlineMarkdown(node) {
      return Array.from(node.childNodes).map((child) => {
        if (child.nodeType === Node.TEXT_NODE) return child.textContent.replace(/\s+/g, ' ');
        if (child.nodeType !== Node.ELEMENT_NODE) return '';
        const tag = child.tagName.toLowerCase();
        const text = inlineMarkdown(child);
        if (tag === 'strong' || tag === 'b') return '**' + text + '**';
        if (tag === 'em' || tag === 'i') return '*' + text + '*';
        if (tag === 'code') return '\`' + child.textContent + '\`';
        if (tag === 'br') return '';
        if (tag === 'a') return '[' + text + '](' + child.getAttribute('href') + ')';
        return text;
      }).join('').trim();
    }
  </script>
</body>
</html>`;
}

function renderBlocks(markdown) {
  const calloutRegex = /<callout\b([^>]*)>([\s\S]*?)<\/callout>/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = calloutRegex.exec(markdown)) !== null) {
    parts.push(renderBasicMarkdown(markdown.slice(lastIndex, match.index)));
    parts.push(renderCallout(match[1], match[2]));
    lastIndex = match.index + match[0].length;
  }

  parts.push(renderBasicMarkdown(markdown.slice(lastIndex)));
  return parts.join('\n');
}

function renderCallout(attributes, content) {
  const icon = getAttribute(attributes, 'icon') || '💡';
  const color = getAttribute(attributes, 'color') || 'gray_bg';
  return `<div class="callout ${escapeAttribute(color)}"><div class="callout-icon">${escapeHtml(icon)}</div><div class="callout-content">${renderBasicMarkdown(content.trim())}</div></div>`;
}

function renderBasicMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let paragraph = [];
  let list = [];
  let code = [];
  let inCode = false;

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };

  const flushList = () => {
    if (list.length) {
      html.push(`<ul>${list.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ul>`);
      list = [];
    }
  };

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
        code = [];
        inCode = false;
      } else {
        flushParagraph();
        flushList();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      code.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      html.push(`<h${heading[1].length}>${renderInline(heading[2])}</h${heading[1].length}>`);
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flushParagraph();
      flushList();
      html.push(`<blockquote>${renderInline(quote[1])}</blockquote>`);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();

  if (inCode) {
    html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
  }

  return html.join('\n');
}

function renderInline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function getAttribute(attributes, name) {
  const match = new RegExp(`${name}="([^"]*)"`).exec(attributes);
  return match ? match[1] : '';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '');
}

module.exports = { activate, deactivate };
