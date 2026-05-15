const vscode = require('vscode');
const { CALLOUTS, QUICK_PICK_ITEMS } = require('./callouts');
const { renderPreview, renderWysiwygEditor } = require('./webview');

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
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider('notionMd.wysiwygEditor', new NotionMarkdownEditorProvider(context), {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: false
    })
  );
  context.subscriptions.push(vscode.commands.registerCommand('notionMd.openWysiwyg', openWysiwyg));
  context.subscriptions.push(vscode.commands.registerCommand('notionMd.openPreview', openPreview));
  context.subscriptions.push(
    vscode.commands.registerCommand('notionMd.insertSuccessCallout', () => insertCallout(CALLOUTS.success))
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('notionMd.insertWarningCallout', () => insertCallout(CALLOUTS.warning))
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('notionMd.insertInfoCallout', () => insertCallout(CALLOUTS.info))
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('notionMd.wrapSelectionInCallout', wrapSelectionInCallout)
  );
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateDecorations));
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (vscode.window.activeTextEditor && event.document === vscode.window.activeTextEditor.document) {
        updateDecorations(vscode.window.activeTextEditor);
        updatePreviewIfNeeded(event.document);
      }
    })
  );

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
      const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
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

  const picked = await vscode.window.showQuickPick(
    QUICK_PICK_ITEMS.map((item) => ({ label: item.label, kind: item.kind })),
    { placeHolder: 'Select Notion callout style' }
  );

  if (!picked) {
    return;
  }

  const choice = CALLOUTS[picked.kind];
  const selection = editor.selection;
  const selectedText = editor.document.getText(selection) || choice.title;
  const replacement = `<callout icon="${choice.icon}" color="${choice.color}">\n${selectedText}\n</callout>`;

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

module.exports = { activate, deactivate };
