# Notion Markdown Editor Backlog

이 문서는 미구현 작업의 단일 소스다. ROADMAP은 Phase 구조를 보고, BACKLOG은 구체 항목을 본다. 항목이 끝나면 체크 표시한 뒤 HISTORY에 옮긴다.

## A WYSIWYG 잔여 버그, 디테일

- [ ] 코드 블록 안 Tab, Shift+Tab 들여쓰기 처리
- [ ] 코드 블록 언어 표기를 WYSIWYG에서 변경할 수 있는 UI
- [ ] 리스트 안에서 Tab으로 nesting
- [ ] H4-H6 toolbar 또는 단축키 노출
- [ ] paste된 텍스트에 inline style(`b`, `i`, `code`) 손실 가능 검토
- [ ] WYSIWYG에서 외부 문서 변경 감지해 webview 재로드(현재는 webview가 source of truth로 동작)

## B Notion Enhanced Markdown 블록

parser, serializer, renderer, WYSIWYG 인터랙션을 함께 갖춘다.

**P0 (Notion sync 문서에서 자주 쓰임)**

- [ ] 체크박스 `- [ ] / - [x]`
- [ ] 토글 `<details><summary>...</summary>...</details>`
- [ ] 이미지 `![alt](url)` + drag-and-drop 업로드
- [ ] 인라인 색상 `{color="..."}`와 배경색

**P1**

- [ ] 테이블 `<table><tr><td>` round-trip + 편집
- [ ] 컬럼 `<columns><column>`
- [ ] 페이지 임베드 `<page url="...">title</page>`
- [ ] 데이터베이스 임베드 `<database url="...">title</database>`
- [ ] 취소선 `~~text~~`
- [ ] 밑줄 `<span underline="true">text</span>`

**P2**

- [ ] 인라인 수식 `$x$`, 블록 수식 `$$x$$`
- [ ] 멘션 `<mention-user>`, `<mention-page>`, `<mention-date>`
- [ ] 동기화 블록 `<synced_block>`, `<synced_block_reference>`
- [ ] 미디어 `<video>`, `<audio>`, `<file>`, `<pdf>`
- [ ] 목차 `<table_of_contents/>`
- [ ] 이모지 단축어 `:emoji_name:`
- [ ] Footnote `[^id]`

## C 편집 UX

- [ ] Slash command `/` 입력 시 블록 타입 메뉴
- [ ] 블록 좌측 hover handle + drag로 순서 변경
- [ ] `**`, `*`, `~~` 자동 변환 (현재는 백틱만)
- [ ] `#`, `##`, `-`, `1.`, `>` 입력 + 스페이스로 블록 타입 변환
- [ ] Cmd+Shift+숫자로 heading 토글 (Notion 호환)
- [ ] Paste 시 markdown 자동 변환
- [ ] Drag 이미지 → `![]()` 자동 삽입

## D Notion Sync 워크플로우 (Phase 2)

- [ ] `Notion Markdown: Copy Pull File to Push` 명령
- [ ] `Notion Markdown: Show Changed Push Files` quick pick
- [ ] `pull/`, `push/` diff 표시
- [ ] frontmatter에서 `notion_page_id`, `notion_url`, `last_edited` 파싱
- [ ] 변경된 파일 목록 status bar 또는 tree view

## E Notion API 연동 (Phase 3)

- [ ] `NOTION_TOKEN` 설정 정의
- [ ] `AI_WORKSPACE_PAGE_ID` 또는 page id 매핑 정의
- [ ] page metadata fetch
- [ ] block children fetch (재귀)
- [ ] Notion block → Enhanced Markdown 변환기
- [ ] Enhanced Markdown → Notion block 변환기
- [ ] 변경된 파일만 update
- [ ] 신규 파일 create
- [ ] rate limit, error 처리

## F 인프라

- [ ] Marketplace 패키징 `vsce package`, icon, changelog, license
- [ ] WYSIWYG webview script를 별도 `.js` 파일로 분리 + CSP 정의
- [ ] 외부 markdown parser(`markdown-it`, `remark`) 도입 검토
- [ ] WYSIWYG 엔진 교체 검토 (ProseMirror, TipTap, Milkdown, Lexical)
- [ ] webview 통합 테스트 (Playwright 또는 VS Code Test API)
- [ ] CI(GitHub Actions) `npm run check`, `npm test` 자동 실행

## 작업 규칙

- 한 항목을 시작하면 `[ ]`을 `[~]`으로 표시한다(WIP)
- 완료하면 `[x]`로 표시하고 다음 정리 커밋에서 HISTORY로 이관 후 제거
- 새로 발견된 항목은 같은 카테고리 아래 추가, 우선순위 표시
- 추천 다음 작업 순서: A 잔여 → B P0 → C 슬래시/단축키 → B P1
