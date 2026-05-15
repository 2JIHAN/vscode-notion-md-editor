# Agent Working Notes

이 문서는 이 저장소에서 작업하는 AI 에이전트 (Claude / Codex / 기타) 가 동일한 실수를 반복하지 않도록 누적되는 운영 메모를 모은다. 각 항목은 "규칙 → Why → How to apply" 구조로 작성한다.

## GhostDesk 컨테이너로 확장을 띄울 때 이미지 선택을 먼저 물을 것

**규칙:** `docker run … ghostdesk …` 실행 전 어떤 이미지를 쓸지 사용자에게 먼저 확인한다.

**Why:** 사용자가 로컬에 직접 빌드한 이미지 (`ghostdesk-vscode:latest` 등) 나 이 저장소 `Dockerfile`/`my-Dockerfile` 로 띄우길 원하는 경우가 많다. 기본 `ghcr.io/yv17labs/ghostdesk:latest` 로 그냥 띄우면 다시 만들어야 한다. 과거 사례: latest 로 띄웠다가 사용자가 "왜 안 물어보냐" 고 지적.

**How to apply:** "ghostdesk 로 창 띄워줘" / "ghostdesk 컨테이너 만들어줘" 류 요청이 오면, `docker run` 실행 전에 후보 이미지 (로컬 빌드본 + 레포의 Dockerfile 들 + 공식 `ghcr.io/yv17labs/ghostdesk:latest`) 를 나열하고 `AskUserQuestion` 으로 선택받는다. 사용자가 이미지를 명시한 경우에만 생략.

## VSCode 확장 QA 시 프로세스를 kill 하지 말 것

**규칙:** GhostDesk 안에서 `--extensionDevelopmentPath` 로 띄운 VSCode 를 다시 띄울 때 `kill -9` 후 재실행하지 않는다. 키 입력 (F5 = Extension Development Host 재시작 / Ctrl+R = window reload) 으로 충분하다.

**Why:** 매번 죽이면 컨테이너 상태가 더러워지고, 다른 vscode 인스턴스도 같이 죽을 수 있고, `pkill -f <pattern>` 은 자기 자신의 docker exec bash 도 같이 잡아서 SIGTERM(143)/SIGKILL(137) 로 종료되는 사이드 이펙트가 있다. 사용자가 명시적으로 지적한 사례 있음.

**How to apply:**
- 코드 변경 후 리로드: Extension Development Host 창에서 `Ctrl+R` (Reload Window). 이 한 번으로 extension host 가 새 모듈을 다시 require 한다.
- 파일 내용 변경: WYSIWYG webview 는 source-of-truth 로 동작하므로 디스크 변경을 자동 감지하지 않는다. 필요하면 `Ctrl+R`.
- 키/마우스 입력은 [GhostDesk MCP 도구](#ghostdesk-마우스키보드-자동화는-mcp-서버를-우선-사용) 로 주입.
- 부득이하게 죽여야 할 때만 `kill` 사용. 그때도 `pkill -f <pattern>` 은 자기 자신을 잡으니 `ps -ef | awk '/[u]sr\/share\/code\/code/ {print $2}' | xargs -r kill -9` 처럼 정규식을 분리해 쓴다.

## GhostDesk 마우스/키보드 자동화는 MCP 서버를 우선 사용

**규칙:** GhostDesk 컨테이너 안에서 마우스 클릭, 키 입력, 스크린샷이 필요하면 port 3000 의 MCP 서버를 1순위로 쓴다. `wtype` / `ydotool` 설치는 폴백.

**Why:** GhostDesk 이미지가 기본으로 노출하는 MCP 도구 (`mouse_click`, `mouse_move`, `mouse_scroll`, `mouse_drag`, `key_press`, `key_type`, `screen_shot`, `clipboard_get`, `clipboard_set`, `app_list`, `app_running`, `app_launch`, `app_status`) 가 가상 데스크탑 자동화의 정식 인터페이스다. 사용자가 "마우스 입력도구 기본 ghostdesk 이미지에 있지 않아?" 라고 지적함.

**How to apply:**

프로토콜은 streamable HTTP. `/mcp` 엔드포인트에 POST 하고 Accept 헤더에 `application/json, text/event-stream` 두 개 모두 포함한다. `initialize` 응답의 `mcp-session-id` 헤더를 이후 모든 요청에 그대로 전달한다.

```bash
SID=$(curl -s -i -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"agent","version":"0.0.1"}}}' \
  | awk -F': ' '/^mcp-session-id/ {print $2}' | tr -d '\r')

call() {
  curl -s -X POST http://localhost:3000/mcp \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "mcp-session-id: $SID" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":99,\"method\":\"tools/call\",\"params\":{\"name\":\"$1\",\"arguments\":$2}}"
}

call key_press '{"keys":"ctrl+r"}'
call mouse_click '{"x":600,"y":600}'
call key_type '{"text":"hello"}'
```

**SEE → ACT → SEE 원칙:** 입력 도구 호출 (`mouse_click`, `key_type`, `key_press`, `mouse_scroll`) 마다 직후에 `screen_shot` 으로 결과를 확인한다. 두 입력을 검사 없이 연속하면 두 번째는 무작정 작동하는 셈이며 가장 흔한 실패 패턴이다.

## VSCode 를 GhostDesk 안에서 agent 사용자로 띄우는 우회법

**규칙:** 이미지의 `/usr/local/bin/code` 래퍼는 `--user-data-dir=/root/.vscode-root` 를 강제하므로 agent 사용자로 실행 시 `EACCES`. 명시적으로 `--user-data-dir=$HOME/.vscode-data --extensions-dir=$HOME/.vscode-ext` 를 넘기거나 래퍼를 교체한다.

**Why:** `/root/.vscode-root` 는 agent 사용자가 쓸 수 없는 경로다. 그대로 두면 "Unable to write program user data" 다이얼로그가 떠 진행 불가.

**How to apply:**

```bash
docker exec -u root ghostdesk-debug bash -c "cat > /usr/local/bin/code << 'EOF'
#!/bin/sh
exec /usr/share/code/code --no-sandbox --user-data-dir=\$HOME/.vscode-data --extensions-dir=\$HOME/.vscode-ext \"\$@\"
EOF
chmod +x /usr/local/bin/code"
```

추가로 Workspace Trust 다이얼로그가 매번 막으면 user `settings.json` 에 `"security.workspace.trust.enabled": false` 를 둔다. WYSIWYG 을 기본으로 띄우려면 `"workbench.editorAssociations": { "*.md": "notionMd.wysiwygEditor" }` 도 함께.

## 작업 끝마다 git push, BACKLOG/HISTORY 동기화

**규칙:** Task 단위로 증각 atomic commit + push. BACKLOG 의 완료 항목은 `[x]` 표시 후 다음 정리 커밋에서 HISTORY 로 이관한다.

**Why:** 사용자가 "작업 끝날 때마다 갱신" 을 선택. 한꺼번에 모아 커밋하면 리뷰가 어렵고 실수 시 되돌리기 부담.

**How to apply:**
- 한 task 가 self-contained 하게 동작하는 시점마다 `git add <관련 파일> && git commit && git push`
- BACKLOG 항목은 작업 시작 시 `[~]` (WIP), 완료 시 `[x]`. 정리 커밋에서 HISTORY 로 이관 + BACKLOG 에서 제거
- HISTORY 는 날짜 `## YYYY-MM-DD` 섹션 안에 의사결정과 구현 요지를 한 단락 또는 짧은 섹션으로 기록
