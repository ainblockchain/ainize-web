---
title: 저장소에 QA 에이전트 붙이기
summary: AIN Teams 채널에 올라온 요청을 GitHub 저장소의 수정으로 바꾸고, 저장소의 검사를 돌린 뒤 승인자가 승인할 PR을 여는 에이전트를 API 키로 등록합니다. 노드는 건드리지 않습니다.
source: en/how-to/qa-agent.md
source_sha256: 68376978910bef465c41b54a8a8113afbadb9efa400532dfa88f6715e1c30e69
aincode: false
---

# 저장소에 QA 에이전트 붙이기

제품을 쓰는 사람들이 채널에 문제를 올립니다. **QA 에이전트**는 그 글을 읽고, 코드를 고치고, 고친 것에 검사를 돌리고,
PR을 열고, 지정한 사람의 승인을 기다립니다. 보통의 Ainize hosted agent이며(`/agents/<id>` 페이지가 있고 AIN Teams
워크스페이스의 멤버입니다), 여기에 노드가 대신 돌리는 파이프라인이 붙습니다.

가장 빠른 방법은 Claude Code에게 시키는 것입니다([Claude Code에서 Ainize 쓰기](./claude-code-skill.md)). 이 페이지는
그때 일어나는 일을 설명합니다. 손으로 하거나, 된 것을 확인할 때 보세요.

## 필요한 것

- 노드 운영자가 **QA를 허가한** 조직. 에이전트는 저장소의 코드를 노드에서 실행하고 노드의 GitHub 계정으로 PR을 열기
  때문에, 어느 조직의 저장소를 받을지는 운영자가 정합니다. `GET /api/orgs/<org>/qa/access`의 `allowed`로 확인합니다.
- 노드의 QA 계정이 쓸 수 있는 GitHub 저장소.
- 조직 API 키, 그리고 AIN Teams와 Ainmem에 로그인할 수 있는 조직 멤버.

## 1. 저장소가 에이전트를 지명합니다

에이전트가 작업할 브랜치의 `ainize.json`에 추가합니다.

```json
{
  "qa": { "agent": "myapp-qa" },
  "checks": [
    { "name": "type-check", "command": ["npm", "run", "type-check"] },
    { "name": "test", "command": ["npm", "test"] }
  ]
}
```

`qa.agent`는 동의입니다. 에이전트는 자신을 지명한 저장소에만 등록됩니다. `checks`는 수정안이 통과해야 하는 게이트이고,
배포가 돌리는 [`checks`](./deploy-with-ainize-json.md)와 같은 것이라 한 번만 적습니다. 각 검사는 의존성이 설치된
컨테이너에서 네트워크 없이 실행됩니다. 브랜치에서 이미 실패하던 검사는 수정안의 실패로 세지 않습니다.

## 2. 채널과 보드

- AIN Teams에 요청을 받을 채널(`qa-myapp`).
- Ainmem에 요청마다 카드가 생기는 보드: 제목, 상태(queued, coding, validating, blocked, completed), 요청으로 가는 링크.

## 3. 등록

```bash
curl -s -X POST https://ainize.ai/api/qa-agents -H "Authorization: Bearer $(cat .ainize_key)" \
  -H 'content-type: application/json' -d @register.json
```

본문에는 에이전트(`-qa`로 끝나는 `id`), 조직, 저장소와 브랜치, Teams 채널, Ainmem 보드, 승인자(AIN SSO 계정과 그
사람의 AIN Teams 사용자 id)를 적습니다. 노드는 저장소를 읽어 이 에이전트를 지명했는지 확인하고, `checks`에서 게이트를
가져오고, 호출한 사람의 권한으로 hosted agent를 만듭니다. 필드는 [HTTP API 레퍼런스](../reference/http-api.md)의
`/api/qa-agents`에 있습니다.

| 필드 | 정하는 것 |
|---|---|
| `approvers` | 수정을 승인할 수 있는 사람. 스레드 답글, 카드 댓글, 승인 버튼으로 승인합니다. |
| `autoMerge` (기본 `true`) | 승인된 PR을 브랜치에 머지할지. 브랜치에 푸시되면 사람이 직접 일으키고 싶은 일(스토어 게시, 마이그레이션)이 벌어지는 저장소는 끕니다. |
| `limits` | 기본값(4 GB, 5분, CPU 2개)으로 부족할 때 검사 하나의 메모리·시간·CPU. |
| `runEvidence` (기본 `false`) | 수정 전후로 앱을 띄워 응답을 첨부합니다. 네트워크·DB·시크릿 없이 뜨는 앱에만 켭니다. |
| `deployment` | 실행 중인 리비전을 읽을 곳. 수정이 실제로 서비스될 때만 요청을 닫습니다. |

## 4. 에이전트의 두 신원

에이전트를 워크스페이스로 가져와(**Agents → Invite agent**) 채널에 넣고, 보드용 자격 증명을 만듭니다. 각각 토큰을 한
번 줍니다. 둘 다 노드에 넘깁니다.

```bash
curl -s -X PUT https://ainize.ai/api/qa-agents/myapp-qa/tokens/teams  -H "Authorization: Bearer $(cat .ainize_key)" \
  -H 'content-type: application/json' -d '{"value":"…"}'
curl -s -X PUT https://ainize.ai/api/qa-agents/myapp-qa/tokens/ainmem -H "Authorization: Bearer $(cat .ainize_key)" \
  -H 'content-type: application/json' -d '{"value":"…"}'
```

쓰기 전용입니다. 에이전트는 이 토큰으로 스레드에 답하고 카드를 갱신합니다. 노드는 자기 사본으로 요청·멤버십·승인을
직접 다시 읽으므로, 에이전트가 하는 말에 기대지 않습니다.

## 5. 동작하기 시작하는 때

| `state` | 뜻 |
|---|---|
| `needs_tokens` | 등록됐고 토큰이 빠져 있습니다. |
| `pending_restart` | 준비 완료. 노드는 시작할 때 QA 설정을 읽으므로, 다음 릴리스부터 채널을 맡습니다. |
| `active` | 채널을 맡고 있습니다. |

그다음 채널에 작은 요청을 최상위 글로 올립니다. 에이전트가 스레드에 답하고, 카드가 보드를 따라 움직이고, 저장소에
PR이 열리면 끝입니다. 배포는 머지가 합니다. 저장소가 [GitHub를 따라가는](./deploy-from-github.md) Ainize 프로젝트라면
머지되면 저절로 배포됩니다.

## 문제가 있을 때

| 보이는 것 | 이유 | 할 일 |
|---|---|---|
| 403 `qa_not_enabled` | 조직이 QA 허가를 받지 않았습니다. | 운영자에게 요청합니다. |
| 422 `repository_unreadable` | 노드의 QA GitHub 계정이 저장소를 읽지 못합니다. | 쓰기 권한으로 추가합니다. |
| 422 `repository_not_declared` | 브랜치의 `ainize.json`이 이 에이전트를 지명하지 않습니다. | 1단계를 먼저 머지합니다. |
| 422 `no_gates` | 저장소에 `checks`가 없고 요청에도 `gates`가 없습니다. | 검사를 추가합니다. |
| 의존성 설치가 "Missing … from lock file"로 실패 | 저장소에 lockfile이 둘이고 오래된 쪽이 쓰였습니다. | `package.json`의 `packageManager`에 관리자를 적거나 오래된 lockfile을 지웁니다. |
| 수정이 "실행 증거를 확인하지 못했습니다"로 계속 코딩 단계로 돌아감 | `runEvidence`가 켜져 있는데 앱이 샌드박스에서 뜨지 않습니다. | `runEvidence: false`로 등록합니다. |

에이전트를 없애려면 `DELETE /api/qa-agents/<id>`를 호출합니다(소유자 또는 조직 관리자).

## 함께 보기

- [Claude Code에서 Ainize 쓰기](./claude-code-skill.md)
- [AIN Teams용 에이전트 만들기](./build-for-ainteams.md)
- [ainize.json 레퍼런스](./deploy-with-ainize-json.md)
