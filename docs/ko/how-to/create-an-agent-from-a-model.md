---
title: 모델로 에이전트 만들기
summary: 이 노드가 서빙하는 대화 모델을 공개 주소가 있는 A2A 에이전트로 만듭니다 — 지시문만으로, 또는 격리된 컨테이너에서 도는 코드로.
source: en/how-to/create-an-agent-from-a-model.md
source_sha256: 907502ad18dbaba5e2a47e1c6a114bfd507131bb0d14d2d94940489f0ee51ef4
---

# 모델로 에이전트 만들기

[에이전트를 노드에 올리기](./host-an-agent.md)는 이미 어딘가에서 돌고 있는 에이전트를 위한 문서입니다. 이 문서는
아직 없는 에이전트를 위한 것입니다. 노드가 서빙하는 모델에서 시작하고, 에이전트는 노드가 대신 돌립니다.

결과는 `<노드>/agents/<id>`에 있는 평범한 A2A 에이전트입니다. 에이전트 카드가 있고, 마켓플레이스와 모델 페이지에
함께 나오며, 그 모델로 돌아가는 링크를 가집니다.

## 대화형 에이전트 작성 표준

1. [Models](/models)에서 도구 호출을 지원하는 모델을 고르고 **Tools** 모드로 만듭니다. 요청 원문과 앞선 대화를 모델에 전달하세요. 모델이 질문의 의미를 해석하고 필요한 도구를 선택한 뒤 반환값으로 사용자의 언어에 맞춰 답합니다. 키워드 분기, 정규식 의도 분류, 고정 도움말로 답하는 경로는 제거하세요.
2. 도구는 한 가지 일을 하고 구조화된 결과를 반환하도록 만듭니다. 아래 예제를 `index.mjs`에 붙이고 **Allowed hosts**에 `ainmem.ainetwork.ai`를 추가하세요. 시스템 지침에는 “현재 배포 버전을 묻는 질문에는 운영 버전을 조회하고 반환된 커밋을 인용한다. 조회에 실패하면 확인 가능한 범위를 설명한다”라고 적습니다.

```js
export const tools = [{
  name: "read_ainmem_version",
  description: "Read the commit currently serving Ainmem and its health.",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  async run(_args, ctx) {
    const response = await ctx.fetch("https://ainmem.ainetwork.ai/api/health");
    if (response.status !== 200) return { error: "health_http", status: response.status };
    const { ok, commit } = await response.json();
    if (ok !== true || typeof commit !== "string" || !/^[a-f0-9]{40}$/.test(commit)) {
      return { error: "health_unconfirmed" };
    }
    ctx.log("read_ainmem_version", { commit });
    return { ok, commit };
  }
}];
```

3. **실행 하네스**는 모델이 요청한 도구의 이름, 인자, 호출자 권한과 대상을 검사하고 실행 결과를 모델에 돌려줍니다. 프로필 주소를 묻는 질문에는 계정 조회 도구를 쓸 수 있습니다. 사진 게시 도구에는 인증된 사용자의 명시적인 게시 요청과 해당 스레드에 속한 파일이 필요합니다. 재전달된 같은 요청에는 최초 실행 결과를 돌려줍니다. 도구가 읽은 메시지나 게시물에 들어 있는 지시로 권한을 확대하지 마세요.
4. 저장한 뒤 “지금 Ainmem에 올라간 버전은?”과 “현재 트래픽을 받는 커밋 알려줘”를 보내세요. **Show logs**와 실제 응답에서 두 질문 모두 같은 읽기 도구를 호출하고 반환된 커밋을 답하는지 확인하세요. 테스트 환경에서 조회 실패, 모호한 쓰기 요청, 중복 전달도 재현하세요. 실패를 성공으로 답하거나 중복 게시하면 출시 검사를 실패 처리하세요.

저장소 수정과 배포까지 담당하는 에이전트에는 [QA 에이전트 작성 표준](./qa-agent.md)도 적용합니다.

## 모델에서 시작하기

1. [모델](/models)을 열고 대화 모델을 고릅니다. 에이전트는 모델과 대화로 주고받기 때문에 대화 모델로만 만들 수 있습니다.
2. **이 모델로 에이전트 만들기**를 누릅니다. 지갑으로 로그인하지 않았다면 먼저 로그인하고 바로 돌아옵니다 —
   에이전트에는 주인이 있어야 하고, 주인은 주소입니다.
3. 모델이 이미 골라진 채로 양식이 열립니다.

## 방식 고르기

| 방식 | 내가 쓰는 것 | 도는 것 |
|---|---|---|
| **프롬프트** | 시스템 프롬프트 | 모델이 그 지시를 따라 답합니다. 코드도 Docker도 없습니다. |
| **도구** | `tools: [{ name, description, parameters, run(args, ctx) }]`를 내보내는 `index.mjs` | 노드가 함수 호출을 주고받으며(최대 8회) 모델이 원할 때 내 도구를 실행합니다 |
| **핸들러** | `execute(input, ctx)`를 내보내는 `index.mjs` | 내 함수가 답 전체를 정합니다 — 점수 계산처럼 정해진 절차에 알맞습니다 |

도구와 핸들러는 편집기에 동작하는 예제가 채워진 채로 시작합니다. 답은 문자열이거나 `{ text, ui }`이고, `ui`는
A2UI 화면(`ctx.ui.surface(id, components, data)`)입니다. 에이전트 카드가 화면을 그릴 수 있다고 알리도록 **A2UI**를 켜세요.

`ctx`가 주는 것 (컨테이너 안팎이 같습니다):

| 멤버 | 뜻 |
|---|---|
| `ctx.input` | `{ text, contextId, history }` |
| `ctx.llm.chat({ messages, ... })` | 에이전트 자신의 모델 |
| `ctx.fetch(url, init)` | 밖으로 나가는 유일한 길 — **허용 호스트**만 답하고, 내부망 주소는 절대 닿지 않습니다 |
| `ctx.secret(name)` | 저장된 비밀값, 없으면 `undefined` |
| `ctx.ui` | A2UI 도우미: `surface`, `text`, `column`, `row`, `card`, `divider`, `list`, `bind` |
| `ctx.log(...)` | 에이전트 로그 — 주인이 읽을 수 있습니다 |

코드는 자기 네트워크가 없는 컨테이너에서 돌기 때문에, Docker가 없는 노드는 두 코드 방식을 거절합니다. 그때는 양식이
그렇다고 알려 주며, 프롬프트 에이전트는 그 노드에서도 그대로 됩니다.

## 파일이 여러 개일 때

에이전트는 `index.mjs`에서 시작하고, 다른 파일 — 설정 파일, 프롬프트 모듈, `src/` 아래의 도우미 — 을 함께 가질 수
있습니다. `index.mjs`가 상대 경로로 import 합니다. 코드 편집기는 모든 파일을 탭으로 보여 줍니다: 탭을 골라 고치고,
**파일 추가**로 새 파일을 만들고(`config.mjs`, `src/prompt.mjs`; 폴더는 세 단계까지), **이 파일 삭제**로 지웁니다.
저장하면 모든 파일이 하나의 새 버전으로 함께 반영되며, 전체 파일 크기 한도는 1MB입니다.

팀이 자주 바꾸는 것은 작은 파일 하나에 따로 두세요(지침 문장과 기준값을 내보내는 `config.mjs`). `index.mjs`가 그것을
import 하면, 에이전트를 조정하는 사람은 코드가 아니라 짧은 파일 하나만 엽니다.

## 허용 호스트와 비밀값

**허용 호스트**는 나갈 수 있는 곳의 목록입니다: `api.example.com`, `*.example.com`, 또는 공개 호스트 전부를 뜻하는 `*`.
**비밀값**은 이름이 먼저 — 에이전트와 함께 저장되고 — 값은 저장한 뒤 하나씩 따로 보내며 다시는 보여주지 않습니다.
수정할 때 값을 비워 두면 저장된 값을 그대로 둡니다.

## 만든 다음

에이전트 페이지는 모델을 링크로, 도는 방식을, 그리고 코드 에이전트라면 빌드가 아직 진행 중인지를 보여줍니다.
주인에게는 **수정**, **삭제**, **로그 보기**(빌드 출력과 최근 실행 로그)도 보입니다.

다른 사람도 함께 관리할 수 있습니다. 에이전트를 [조직](./organizations.md)에 공유하면(**공개 범위** → *조직*) 그
조직의 `write` 멤버 모두에게 같은 **수정**과 **로그 보기**가 보입니다 — 코드, 모델, 비밀값, 로그까지. 삭제와 공개 범위
변경은 만든 사람과 조직 관리자에게 남습니다. 파일을 보내서 넘겨줄 것이 없습니다: 로그인해서 에이전트 페이지를 열면 됩니다.

## 내 프로그램에서 호출하기

에이전트 주소는 HTTPS 위의 평범한 [A2A](https://a2a-protocol.org/)라서, CMS나 스크립트가 POST 한 번으로 부릅니다:

```bash
curl -s https://ainize.ai/agents/<id> -H 'content-type: application/json' -H 'A2A-Version: 1.0' -d '{
  "jsonrpc": "2.0", "id": "1", "method": "SendMessage",
  "params": { "message": { "role": "ROLE_USER", "messageId": "<메시지마다 새 id>", "parts": [{ "text": "hello" }] } }
}'
```

답은 `result.message.parts`에 있습니다: 사람이 읽는 `text` 파트와, 에이전트가 구조화된 파트를 돌려줄 때는 프로그램이
읽는 `data` 파트. 메시지마다 새 `messageId`를 보내세요 — 같은 id를 다시 보내면 앞의 답이 그대로 돌아옵니다. 코드
에이전트는 답 하나에 2분을 씁니다. 이 주소는 인증을 받지 않으므로(A2A는 인증을 보내지 않습니다) 주소를 아는 사람은
누구나 부를 수 있습니다: 낯선 사람이 일으켜서는 안 되는 일을 에이전트가 비밀값으로 하게 두지 마세요.

같은 경로가 곧 API입니다: `POST /api/hosted-agents`, `PUT`/`DELETE /api/hosted-agents/<id>`,
`PUT /api/hosted-agents/<id>/secrets/<name>`, `GET /api/hosted-agents/<id>/logs` — 모두 로그인한 세션으로 호출합니다.
