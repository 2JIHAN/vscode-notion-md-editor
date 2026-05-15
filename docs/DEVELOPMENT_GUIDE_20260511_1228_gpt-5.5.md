# Notion Markdown Editor Development Guide

## 목적

이 문서는 확장을 이어서 개발할 때 필요한 실행, 검증, 변경 기준을 정리한다.

## 실행

1. VS Code에서 프로젝트 폴더를 연다.

```text
/Users/sonuvis-jihan/agent-workspace/vscode-notion-md-editor
```

2. `F5`를 눌러 Extension Development Host를 실행한다.

3. 테스트용 VS Code 창에서 `.md` 파일을 연다.

4. Command Palette에서 아래 명령을 실행한다.

```text
Notion Markdown: Open WYSIWYG Editor
```

## 주요 명령

| 명령 | 역할 |
| --- | --- |
| `Notion Markdown: Open WYSIWYG Editor` | 현재 Markdown 파일을 WYSIWYG custom editor로 열기 |
| `Notion Markdown: Open Preview` | Notion 스타일 preview 열기 |
| `Notion Markdown: Insert Success Callout` | 성공 기준 callout 삽입 |
| `Notion Markdown: Insert Warning Callout` | 경고 callout 삽입 |
| `Notion Markdown: Insert Info Callout` | 정보 callout 삽입 |
| `Notion Markdown: Wrap Selection in Callout` | 선택 영역을 callout으로 감싸기 |

## 검증

현재는 별도 build step이 없다. 기본 검사는 아래 명령으로 수행한다.

```bash
npm run check    # 모든 src 모듈 문법 검사
npm test         # markdown round-trip + 단위 테스트
```

`npm test`는 외부 의존성 없이 Node 기본 `assert`로 동작한다.

## WYSIWYG 단축키

| 단축키 | 동작 |
| --- | --- |
| `Cmd/Ctrl+B` | Bold 토글 |
| `Cmd/Ctrl+I` | Italic 토글 |
| `Cmd/Ctrl+E` | Inline code 토글 |
| `Cmd/Ctrl+Shift+S` | Strikethrough 토글 (Notion 호환) |
| `Cmd/Ctrl+Z` | Undo (contenteditable native) |
| `Cmd/Ctrl+Shift+Z` | Redo |

## WYSIWYG autoformat

**라인 첫머리 + space 트리거**

| 입력 | 변환 |
| --- | --- |
| `# ` ~ `###### ` | H1 ~ H6 |
| `- `, `* `, `+ ` | 불릿 리스트 |
| `숫자. ` | 번호 리스트 (start 속성 유지) |
| `[] `, `[ ] `, `[x] ` | 할 일 체크박스 (`todo-list`) |
| `" ` | blockquote |
| `> ` | 토글 (`<details><summary>`, 요약 전체 선택) |

**즉시 변환 (space 불필요)**

- `---` 3번째 dash 입력 시 즉시 구분선 (`***`/`___` 는 변환 안 함)
- 한 줄에 `` ``` `` 만 입력하면 즉시 fenced code block

**인라인 감싸기 (닫는 마커 입력 시)**

| 입력 | 변환 |
| --- | --- |
| `**text**` | `<strong>` |
| `*text*` / `_text_` | `<em>` |
| `~~text~~` / `~text~` | `<del>` |
| `` `text` `` | `<code>` |
| `[text](url)` | `<a href>` (이미지 `![](...)` 는 제외) |

**기타**

- 코드 블록 내부 Enter 는 새 블록 생성 대신 줄바꿈 삽입
- 빈 callout 본문에서 Backspace 시 paragraph 로 복원

## 슬래시 메뉴

빈 단락에서 `/` 입력 시 캐럿 위치에 검색 가능한 블록 선택 팝업이 뜬다. 13 항목: H1/H2/H3, 불릿/번호/체크/토글 리스트, 인용, 코드 블록, 구분선, 토글, 콜아웃 3종(성공/주의/정보).

| 키 | 동작 |
| --- | --- |
| 위/아래 화살표 | 항목 이동 |
| Enter | 선택 |
| Esc, 메뉴 밖 클릭, 필터에 공백 | 닫기 |

이전 툴바의 H1/H2/B/Code/Callout 드롭다운+버튼은 모두 슬래시 메뉴로 흡수되었다. 툴바에는 `Saved` 상태 표시와 `Light/Dark/Auto` 테마 토글만 남는다.

## 폰트

- 본문 system sans-serif (한글 Apple SD Gothic Neo, Malgun Gothic fallback)
- 코드 Menlo + D2Coding fallback (Nerd Font 변형 사용 안 함)
- 색상 토큰은 `:root[data-theme="..."]`에 정의된 `--nme-*` 변수 사용

## 수동 테스트 체크리스트

- `.md` 파일을 기본 editor로 열 수 있음
- `Open WYSIWYG Editor` 명령으로 custom editor가 열림
- 빈 단락에서 `/` 입력 시 슬래시 메뉴가 떠야 함
- 슬래시 메뉴에서 화살표/Enter 로 H1/H2/H3, 리스트, 콜아웃 등을 삽입 가능
- 라인 첫머리 + space autoformat 동작 (`# `, `- `, `1. `, `[] `, `" `, `> `)
- 인라인 감싸기 autoformat 동작 (`**bold**`, `*italic*`, `~~strike~~`, `[text](url)`)
- bold, italic, strikethrough 키보드 단축키 (`Cmd+B`/`Cmd+I`/`Cmd+Shift+S`) 동작
- inline code 한 쌍의 백틱으로 자동 변환
- 세 백틱만으로 즉시 fenced code block 변환
- `---` (3개 dash) 즉시 구분선 변환
- 토글 클릭으로 펼침/접힘 동작
- 체크박스 클릭으로 체크 상태 토글
- WYSIWYG 수정 후 원본 Markdown 에 반영됨
- WYSIWYG에서 Cmd+Z로 직전 입력 되돌리기 가능
- 상단 우측 테마 토글 버튼으로 Auto, Light, Dark 순환 가능
- 기본 editor에서 `<callout>` snippet 삽입 가능
- preview에서 callout이 Notion 스타일로 표시됨

## GhostDesk 컨테이너 QA

확장을 라이브 검증할 때 GhostDesk 가상 데스크탑 컨테이너를 활용한다. `ghcr.io/yv17labs/ghostdesk:latest` 와 로컬 `ghostdesk-vscode:latest` (VSCode 내장 변형) 두 가지가 있다.

### 컨테이너 기동 시 주의

**이미지 선택을 먼저 확정한다.** 기본 `latest` 와 로컬 빌드본은 동봉 도구가 다르다. VSCode 가 필요하면 `ghostdesk-vscode:latest`.

```bash
docker run -d --name ghostdesk-debug --shm-size 2g \
  -p 3000:3000 -p 6080:6080 \
  ghostdesk-vscode:latest
```

- noVNC: http://localhost:6080
- MCP: http://localhost:3000/mcp (streamable HTTP)

### VSCode 를 agent 유저로 실행

이미지의 `/usr/local/bin/code` 래퍼는 `--user-data-dir=/root/.vscode-root` 를 강제하므로 agent 사용자 실행 시 EACCES. wrapper 를 교체하거나 직접 `/usr/share/code/code` 를 호출하면서 `--user-data-dir=$HOME/.vscode-data --extensions-dir=$HOME/.vscode-ext` 를 명시한다.

Workspace trust 다이얼로그는 user settings 에 `security.workspace.trust.enabled: false` 로 차단. WYSIWYG 을 기본으로 띄우려면 user settings 와 workspace `.vscode/settings.json` 에 `"workbench.editorAssociations": { "*.md": "notionMd.wysiwygEditor" }` 를 둔다.

소스 변경 후에는 컨테이너로 동기화한 뒤 **kill 하지 말고 `Ctrl+R` (Reload Window) 로 reload** 한다. extension host 가 새 모듈을 다시 로드한다.

```bash
docker cp src ghostdesk-debug:/home/agent/notion-md-editor/
docker exec -u root ghostdesk-debug chown -R agent:agent /home/agent/notion-md-editor/src
```

### 마우스/키보드 자동 주입

이미지 기본 MCP 서버가 `mouse_click`, `key_press`, `key_type`, `screen_shot`, `clipboard_set` 등을 노출한다. HTTP streamable transport 라 `initialize` 응답의 `mcp-session-id` 헤더를 이후 모든 호출에 포함해야 한다.

```bash
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SID" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"key_press","arguments":{"keys":"ctrl+r"}}}'
```

SEE → ACT → SEE 원칙: 각 입력 도구 호출 사이에 `screen_shot` 으로 결과를 확인한다.

폴백 — `apt install wtype` 으로 키 주입도 가능하지만 (Wayland virtual-keyboard 프로토콜, uinput 불필요), MCP 도구를 우선 사용한다.

## 코드 변경 기준

- `src/extension.js`는 현재 단일 파일이지만 기능이 커지면 모듈 분리
- renderer와 serializer는 우선 테스트 가능한 순수 함수로 분리
- Notion API 연동은 editor UI와 분리된 sync 모듈로 작성
- 외부 dependency 추가 전 번들 크기와 webview CSP 영향 확인
- Markdown 손실 가능성이 있는 변경은 History에 기록

## 추천 다음 작업

세부 backlog은 [`BACKLOG.md`](./BACKLOG.md) 참고. 상위 카테고리는 다음과 같다.

1. A WYSIWYG 잔여 버그, 디테일 (Tab nesting, Backspace 보호 등)
2. B P0 블록 (체크박스, 토글, 구분선, 이미지, 인라인 색상)
3. C 편집 UX (slash command, markdown shortcut, drag handle)
4. B P1 블록 (테이블, 컬럼, 페이지/데이터베이스 임베드)
5. D Phase 2 Notion sync 워크플로우 명령
6. E Phase 3 Notion API 연동
7. F 인프라 (패키징, ESLint, CSP, 엔진 교체)
