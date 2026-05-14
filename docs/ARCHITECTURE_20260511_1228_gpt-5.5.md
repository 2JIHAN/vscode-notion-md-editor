# Notion Markdown Editor Architecture

## 개요

이 확장은 VS Code Markdown 파일을 두 가지 방식으로 다룬다.

- 기본 Markdown editor 보조 기능
- Notion 스타일 WYSIWYG custom editor

두 방식 모두 같은 `.md` 파일을 대상으로 하며, Notion Enhanced Markdown 스타일 `<callout>` 태그를 보존한다.

## 현재 구조

```text
vscode-notion-md-editor/
├── package.json
├── README.md
├── src/
│   └── extension.js
└── docs/
```

## 주요 구성요소

| 구성요소 | 위치 | 역할 |
| --- | --- | --- |
| Extension activation | `src/extension.js` | 명령, decoration, custom editor 등록 |
| Text editor commands | `src/extension.js` | callout snippet 삽입, 선택 영역 감싸기 |
| Preview webview | `src/extension.js` | Markdown을 Notion 스타일 HTML로 렌더링 |
| Custom editor provider | `src/extension.js` | `.md` 파일을 WYSIWYG editor로 표시 |
| Markdown renderer | `src/extension.js` | Markdown subset을 HTML로 변환 |
| WYSIWYG serializer | webview script | HTML 편집 결과를 Markdown으로 변환 |

## 데이터 흐름

### 기본 Markdown editor

1. 사용자가 `.md` 파일을 VS Code 기본 editor로 연다.
2. 확장이 `onLanguage:markdown`으로 활성화된다.
3. 사용자가 callout 삽입 명령을 실행한다.
4. 확장이 현재 selection 위치에 `<callout>` snippet을 삽입한다.
5. decoration이 `<callout>` 블록 범위를 시각적으로 표시한다.

### WYSIWYG custom editor

1. 사용자가 `Open WYSIWYG Editor` 명령을 실행한다.
2. VS Code가 `notionMd.wysiwygEditor` custom editor를 연다.
3. provider가 `TextDocument` 내용을 읽어 webview HTML로 렌더링한다.
4. 사용자가 webview의 `contenteditable` 영역을 편집한다.
5. webview script가 편집된 DOM을 Markdown 문자열로 직렬화한다.
6. webview가 extension host로 `update` 메시지를 보낸다.
7. extension host가 `WorkspaceEdit`으로 원본 문서를 교체한다.
8. VS Code 저장 흐름은 일반 텍스트 문서와 동일하게 동작한다.

## 문서 모델

VS Code `CustomTextEditorProvider` 계열 구조를 따른다. 문서의 실제 source of truth는 VS Code `TextDocument`다. webview는 편집 UI이며, 편집 결과를 Markdown 문자열로 되돌려 문서에 반영한다.

## Markdown 지원 범위

현재 renderer와 serializer가 안정적으로 지원하는 범위:

- `#`, `##`, `###` heading
- paragraph
- unordered list
- ordered list
- blockquote
- fenced code block
- inline code
- bold
- link
- `<callout icon="..." color="...">...</callout>`

제한 범위:

- table
- nested list
- image
- task list
- footnote
- raw HTML block
- frontmatter

## Callout 구조

로컬 Markdown 표준:

```md
<callout icon="⚠️" color="yellow_bg">
주의할 내용
</callout>
```

렌더링 HTML 구조:

```html
<div class="callout yellow_bg" data-icon="⚠️" data-color="yellow_bg">
  <div class="callout-icon">⚠️</div>
  <div class="callout-content">...</div>
</div>
```

## 확장 포인트

- Markdown parsing을 `markdown-it`, `unified`, `remark` 계열로 교체
- WYSIWYG editor 엔진을 ProseMirror, Milkdown, TipTap 중 하나로 교체
- Notion API block 변환기 추가
- `notion-sync/pull`, `notion-sync/push` diff 명령 추가
- file metadata에서 Notion page id, last edited time 읽기

## Sources

- [VS Code Custom Editor API](https://code.visualstudio.com/api/extension-guides/custom-editors)
- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [VS Code custom editor sample](https://github.com/microsoft/vscode-extension-samples/tree/main/custom-editor-sample)
