---
title: 저장소에 QA 에이전트 붙이기
summary: AIN Teams 채널에 올라온 요청을 GitHub 저장소의 수정으로 바꾸고, 저장소의 검사를 돌린 뒤 승인자가 승인할 PR을 여는 에이전트를 API 키로 등록합니다. 노드는 건드리지 않습니다.
source: en/how-to/qa-agent.md
source_sha256: 7b7c8658eb7227b1676796a1468d4bf0cf506145ea690c9427a35c96a85ef2b3
aincode: false
---

# 저장소에 QA 에이전트 붙이기

제품을 쓰는 사람들이 채널에 문제를 올립니다. **QA 에이전트**는 그 글을 읽고, 코드를 고치고, 고친 것에 검사를 돌리고,
PR을 열고, 지정한 사람의 승인을 기다립니다. 보통의 Ainize hosted agent이며(`/agents/<id>` 페이지가 있고 AIN Teams
워크스페이스의 멤버입니다), 여기에 노드가 대신 돌리는 파이프라인이 붙습니다.

가장 빠른 방법은 Claude Code에게 시키는 것입니다([Claude Code에서 Ainize 쓰기](./claude-code-skill.md)). 이 페이지는
그때 일어나는 일을 설명합니다. 손으로 하거나, 된 것을 확인할 때 보세요.

## QA 에이전트 작성 표준

[도구 호출형 에이전트](./create-an-agent-from-a-model.md)를 기본 구조로 사용합니다. 아래 등록 절차로 저장소와 채널을 묶은 뒤, 원문 읽기, 저장소 검사, 수정안 검증, Run 조회, 운영 재현 결과 조회를 각 권한에 맞는 도구로 제공합니다. 모델은 원문·첨부·이전 시도의 결과를 읽고 다음 도구와 답변을 결정합니다. 하네스는 허용 저장소·채널, 승인 상태, 호출 한도, 중복 실행과 게시 권한을 검사합니다.

| 시점 | 하네스가 확인할 증거 | 게시 위치와 내용 |
|---|---|---|
| 접수 | 요청 메시지 ID에 연결된 작업이 저장됨 | 원래 QA 스레드에 사용자가 겪은 증상을 반영해 한 번 답합니다. |
| 검사·도구·모델·배포 실패 | 작업 ID, 실패 단계, 가능한 경우 Run 링크·종료 코드, 민감정보를 제거한 마지막 출력 | `#monitoring-agents`에 기록합니다. 원래 스레드에는 중간 답변을 게시하지 않습니다. |
| 수정 확인 | 대상 커밋의 Run 성공, 서비스 헬스체크, 실제 서비스 커밋 일치, 원래 사용 경로 재현 통과 | 원래 QA 스레드에 무엇이 고쳐졌고 어떻게 확인했는지 한 번 답합니다. |

게시 전 모델에 요청 원문과 검증 결과를 함께 제공하세요. 접수와 완료는 게시할 수 있는 사건의 종류이며 답변 문구는 요청마다 생성합니다. 모델이나 조회 도구가 실패하면 오류를 보존하고 재시도합니다. 새 Run을 기존 실패와 연결하고, 에이전트 복구 뒤 미해결 사례를 다시 실행하세요. 생성한 PR이나 통과한 단위 검사만으로 완료를 게시하지 마세요.

인수 검사에서는 같은 증상을 낯선 표현으로 다시 접수한 경우, 중복 이벤트, 모델 시간 초과, 배포 커밋 불일치, 원래 증상이 남은 경우를 각각 실행합니다. 테스트 채널에서 도구 호출 기록과 게시 횟수를 확인하세요. 실패 중에는 모니터링 기록만 늘고, 정상 복구 후 원래 스레드에는 접수와 검증된 완료가 각각 한 번 있어야 합니다.

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

테스트 채널에 작은 요청을 올려 접수부터 승인까지 보드에서 추적하세요. 승인이 끝나면 [Runs](/runs)에서 머지 커밋의 운영 Run을 열고 단계별 결과와 실제 운영 커밋을 확인하세요. 신고한 동작을 다시 실행해 통과한 뒤 완료 답변을 게시합니다. 승인 대기는 보드에서 확인합니다.

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
