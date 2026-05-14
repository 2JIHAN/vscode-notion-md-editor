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
| `Cmd+B` | Bold 토글 |
| `Cmd+I` | Italic 토글 |
| `Cmd+E` | Inline code 토글 |
| `Cmd+Z` | Undo (contenteditable native) |
| `Cmd+Shift+Z` | Redo |

## WYSIWYG autoformat

- `` `text` `` 입력 시 자동으로 `<code>` 변환
- 한 줄에 `` ``` `` 만 입력하면 즉시 fenced code block 변환 (Enter 불필요)
- 코드 블록 내부 Enter는 새 블록 생성 대신 줄바꿈 삽입

## 폰트

- 본문 system sans-serif (한글 Apple SD Gothic Neo, Malgun Gothic fallback)
- 코드 Menlo + D2Coding fallback (Nerd Font 변형 사용 안 함)
- 색상 토큰은 `:root[data-theme="..."]`에 정의된 `--nme-*` 변수 사용

## 수동 테스트 체크리스트

- `.md` 파일을 기본 editor로 열 수 있음
- `Open WYSIWYG Editor` 명령으로 custom editor가 열림
- toolbar에서 H1, H2 적용 가능
- bold, inline code 적용 가능
- success, warning callout 삽입 가능
- WYSIWYG 수정 후 원본 Markdown에 반영됨
- WYSIWYG에서 Cmd+Z로 직전 입력 되돌리기 가능
- 백틱 한 쌍으로 inline code 자동 변환 동작
- 백틱 세 개 + Enter로 fenced code block 자동 변환 동작
- 상단 우측 테마 토글 버튼으로 Auto, Light, Dark 순환 가능
- 기본 editor에서 `<callout>` snippet 삽입 가능
- preview에서 callout이 Notion 스타일로 표시됨

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
