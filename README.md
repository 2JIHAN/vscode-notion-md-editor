# Notion Markdown Editor

Notion MCP, Notion API, 로컬 Markdown 동기화 흐름에 맞춘 VS Code Markdown editor 확장이다.

## 기능

- Notion Enhanced Markdown 스타일 `<callout>` 삽입
- 선택 영역을 callout으로 감싸기
- Markdown editor에서 callout 블록 라인 장식
- Notion 스타일 callout을 렌더링하는 간단 preview
- `.md` 파일을 Notion 스타일 WYSIWYG custom editor로 열기
- WYSIWYG에서 수정한 내용을 원본 Markdown 문서에 저장

## WYSIWYG 사용

1. VS Code에서 이 폴더를 연다.
2. `F5`로 Extension Development Host를 실행한다.
3. 테스트용 VS Code 창에서 `.md` 파일을 연다.
4. `Cmd + Shift + P`를 누른다.
5. `Notion Markdown: Open WYSIWYG Editor`를 실행한다.

또는 `.md` 파일 탭에서 `Open With...`를 선택한 뒤 `Notion Markdown Editor`를 고른다.

WYSIWYG editor에서 지원하는 MVP 기능:

- H1, H2
- Bold
- Inline code
- Success, Warning, Info callout 삽입
- Paragraph, bullet list, numbered list, quote, code block 표시와 저장

주의할 점:

- 아직 완전한 Markdown round-trip editor는 아니다.
- 복잡한 table, nested list, image, HTML block은 손실될 수 있다.
- Notion sync용 문서처럼 callout과 일반 문단 위주로 쓰는 용도에 맞춘 MVP다.

## Callout 문법

```md
<callout icon="✅" color="green_bg">
**성공 기준**

업로드가 정상 완료된 상태
</callout>
```

```md
<callout icon="⚠️" color="yellow_bg">
USB 케이블이 충전 전용이면 포트가 보이지 않을 수 있다.
</callout>
```

## 실행

1. VS Code에서 이 폴더를 연다.
2. `F5`로 Extension Development Host를 실행한다.
3. Markdown 파일을 연다.
4. Command Palette에서 `Notion Markdown` 명령을 실행한다.

## 참고한 설치 확장

- `concretio.markdown-for-humans` custom editor 등록 방식
- `shd101wyy.markdown-preview-enhanced` preview command 방식
- `yzhang.markdown-all-in-one` Markdown 편집 command 방식