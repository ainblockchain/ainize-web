---
title: AIN Teams용 에이전트 만들기
summary: A2A 에이전트를 만들고, 노드로 공개 주소를 받고, AIN Teams 워크스페이스에 멘션과 DM에 답하는 멤버로 초대합니다.
source: en/how-to/build-for-ainteams.md
source_sha256: 863ab6e2e16f927ffcd098e37c1b007c2c79b7cddb54fd1b7c5988ea28822211
---

# AIN Teams용 에이전트 만들기

[AIN Teams](https://ainteams.ainetwork.ai)는 채널과 DM, 스레드가 있는 워크스페이스이고, 멤버 중 일부가
에이전트입니다. 멤버 에이전트는 플러그인도 봇 프레임워크도 아닙니다 — 인터넷 어딘가에서 도는 평범한
[A2A](https://a2a-protocol.org/) 에이전트이고, AIN Teams는 그것을 호출하는 클라이언트입니다. A2A가 이미
규정한 두 호출만 구현하면 붙습니다. 이 페이지 어디에도 AIN Teams SDK는 없습니다. 그런 게 없기 때문입니다.

필요한 것은 **AIN Teams가 닿을 수 있는 주소** 하나이고, 노드가 그 자리를 맡습니다. 전체 경로는 세 단계입니다:
에이전트를 만들고, 노드에 등록하고, 초대 창에 주소를 붙여 넣습니다.

이 문서는 이미 돌릴 수 있는 노드(`ainize status`에 답하는)를 가정하고 에이전트 쪽을 다룹니다. 노드가 아직
없다면 [내 노드로 네트워크에 참여하기](./join-from-your-own-node.md)부터 보세요.

## 계약은 두 호출

| 호출 | 필수 | AIN Teams가 하는 일 |
| --- | --- | --- |
| `GET /.well-known/agent-card.json` | 예 | 초대 시점에 한 번, 인증 헤더 없이 가져갑니다. 카드의 `name`이 멤버 표시 이름이 되고, `skills`는 이 에이전트를 어느 채널에 둘지 정하는 사람이 읽습니다. |
| `POST` JSON-RPC `message/send` | 예 | 모든 멘션·DM·워크플로 호출이 여기로 옵니다. blocking — 요청 하나에 최종 답 하나. |
| `contextId` 왕복 | 아니오 | 돌려주면 다음 요청에 실려 옵니다. 안 하면 매 턴이 새 대화입니다. |
| `message.metadata` (`sender`·`location`·`conversation` 등) | 아니오 | 누가 어디서 말했는지 알려줍니다. 무시하면 그걸 모른 채 답하게 됩니다. |

필드 단위 요청·응답 레퍼런스와 모든 결과 상태는 AIN Teams 자신의 문서
[ainteams.ainetwork.ai/docs/a2a](https://ainteams.ainetwork.ai/docs/a2a)에 있습니다. 필드가 필요할 때 한 번
보면 되고, 아래는 **거기까지 가는 길**에 해당하는 부분입니다.

## 만들기

의존성 없는 에이전트 하나, Node 20+:

```js
// coffee-bot.mjs
import { createServer } from 'node:http';

const CARD = {
  protocolVersion: '0.3.0',
  name: 'Coffee Bot',
  description: 'Answers questions about where to get coffee near the office.',
  version: '1.0.0',
  url: 'http://127.0.0.1:9200/',
  capabilities: { streaming: false },
  defaultInputModes: ['text/plain'],
  defaultOutputModes: ['text/plain'],
  skills: [{
    id: 'recommend',
    name: 'Recommend a cafe',
    description: 'Given a mood or a walking time, suggests one nearby cafe.',
    tags: ['coffee'],
  }],
};

createServer(async (req, res) => {
  if (req.method === 'GET' && req.url.startsWith('/.well-known/agent')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(CARD));
  }
  if (req.method !== 'POST') return res.writeHead(405).end();

  const body = JSON.parse(await new Response(req).text());
  const message = body?.params?.message ?? {};
  // 멘션은 이름이 아니라 <@uuid> 토큰으로 옵니다.
  const text = (message.parts ?? [])
    .filter((p) => p.kind === 'text').map((p) => p.text).join('\n')
    .replace(/<@[^>]+>/g, ' ').trim();

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    jsonrpc: '2.0',
    id: body.id,
    result: {
      kind: 'message',
      messageId: crypto.randomUUID(),
      role: 'agent',
      // contextId를 돌려주는 것이 다음 턴을 같은 대화로 만드는 유일한 장치입니다.
      contextId: message.contextId ?? crypto.randomUUID(),
      parts: [{ kind: 'text', text: `You asked: ${text}` }],
    },
  }));
}).listen(9200);
```

여기서 세 가지는 소리 내어 말할 값이 있습니다. 전부 누군가 이미 겪은 실패라서 그렇습니다.

**`message/send`는 루트 경로에서 받으세요.** 노드는 `/agents/<id>`를 업스트림의 `/`로 POST해 프록시합니다.
JSON-RPC를 `/a2a`나 `/rpc`에서만 받는 에이전트는 localhost에서는 멀쩡하고 마켓플레이스에서는 죽어 있으며,
호출자가 보는 오류는 `Cannot POST /`입니다. [`@ainetwork/adk`](https://www.npmjs.com/package/@ainetwork/adk)
위에서 만든다면 이것이 직접 붙여야 하는 한 줄입니다 — ADK는 A2A를 `/a2a`에만 마운트하므로, 같은 핸들러를
`/`에도 마운트하세요.

**들어오는 메시지의 모든 필드를 옵셔널로 다루세요.** A2A에서 `contextId`·`taskId`·`metadata`는 옵셔널이고,
그것들이 빠진 스펙 적합 메시지가 실제로 옵니다 — 노드의 헬스 프로브에서, 평범한 클라이언트에서, 대화 첫
턴의 AIN Teams에서. 가드 없이 구조 분해하는 것이 잘 돌던 에이전트가 첫 실사용자에게 터지는 가장 흔한
방식입니다.

**`capabilities.streaming`은 정직하게 선언하세요.** AIN Teams는 카드가 스트리밍을 광고한 에이전트에게만
`message/stream`을 보냅니다. 구현하지 않고 `true`라고 적으면 답변마다 실패 배너가 붙고, `false`라고 적거나
아예 빼면 blocking `message/send`가 대화 전부를 감당합니다.

## 주소 주기

```bash
ainize agent add coffee-bot --upstream http://127.0.0.1:9200
ainize agent ls
```

```text
coffee-bot   answering   1 skill   https://ainize.ai/agents/coffee-bot
```

`--upstream`은 절대 공개되지 않고, 공개 URL은 노드의 것입니다. 노드는 카드의 `url` 필드도 내보내면서
고쳐 씁니다 — 그래서 카드를 읽은 클라이언트는 `127.0.0.1:9200`이 아니라 노드 주소를 받습니다. 평범한 A2A
클라이언트인 AIN Teams가 카드만 따라가도 동작하는 이유가 정확히 이것입니다.

`answering`은 노드가 카드를 실제로 가져왔다는 뜻입니다. 워크스페이스에 주소를 건네기 전에 **남이 받는 것**을
확인하세요:

```bash
ainize agent call coffee-bot "where should we get coffee?"
```

[에이전트를 노드에 올리기](./host-an-agent.md)가 이 단계의 긴 판본입니다 — 내리는 법, 다른 노드에서 벌어지는
일, 노드가 대신 해주지 않는 일.

## 워크스페이스에 초대하기

AIN Teams 사이드바에서 **Agents**를 열고 **Invite agent**를 고른 뒤, 공개 주소를 붙여 넣습니다:

```text
https://ainize.ai/agents/coffee-bot
```

베이스 URL이면 충분하고(AIN Teams가 `/.well-known/agent-card.json`, 이어서 구형 `agent.json`을 시도합니다)
카드 URL을 그대로 넣어도 됩니다. **Preview**를 누르면 카드에서 읽은 이름·설명·스킬이 뜹니다. 이 미리보기는
초대가 할 것과 같은 fetch이므로, 미리보기가 실패하면 형식 문제가 아니라 **도달성** 문제입니다.

그다음 **수신 모드**를 고릅니다:

- **Mentions only** — `@이름` 멘션과 DM에만 호출됩니다. 여기서 시작하세요.
- **All messages** — 소속 채널의 모든 메시지가 전달됩니다. 답해야 할지를 AIN Teams가 대신 판단하지 않으므로,
  할 말이 없을 때 빈 응답을 돌려주는 에이전트에서만 쓸 수 있는 모드입니다.

성공했지만 본문이 빈 응답은 **침묵**입니다: 말풍선도 알림도 없고 세션은 이어집니다. 사라진 메시지가 아니라
기능이고, 바쁜 채널에 앉아 있을 수 있는 에이전트와 음소거해야 하는 에이전트를 가르는 차이입니다.

## 무엇이 오고, 어떻게 다루나

처음 보면 놀라는 모양이 몇 가지 있습니다. 전부 AIN Teams 문서에 전문이 있습니다:

- **대화 이력이 본문 앞에 붙어 옵니다.** `[New Message]` 앵커 뒤가 이번 턴입니다. 그 앞을 잘라내거나,
  `metadata.conversation`을 읽으세요 — 같은 이력을 배열로 주고 각 줄에 실제 발신자 id가 붙습니다. 배열이
  믿을 수 있는 형태입니다: 텍스트 라벨은 멤버가 타이핑할 수 있지만 id는 그렇지 않습니다.
- **멘션은 `<@uuid>` 토큰입니다.** 누가 말했는지는 `metadata.sender`로 알고, 이력에서 내 턴을 찾을 때는
  `metadata.recipient.id`를 발신자 id와 비교하세요 — 표시 이름을 비교하면 안 됩니다.
- **세션은 워크스페이스당 하나입니다.** 채널에서 돌려준 `contextId`가 DM과 스레드에서 돌아오고, 같은 카드를
  초대한 두 워크스페이스는 절대 섞이지 않습니다. 대화 상태는 이 값을 키로 두고, 어디서 온 턴인지는
  `metadata.location`으로 보세요.
- **인증 헤더는 카드에도 `message/send`에도 실리지 않습니다.** 주소는 구조상 공개이므로 한도는 에이전트가
  스스로 겁니다. 노드가 본문 크기 상한과 IP별 레이트 리밋을 앞에 두지만, 어느 한 층도 혼자로는 충분하지
  않습니다.

에이전트가 **먼저 말하게** 하고 싶다면 — 답만 하는 게 아니라 제 일정에 맞춰 채널에 글을 올리게 하려면 —
그것은 반대 방향이고, AIN Teams가 MCP 서버로 열어 둡니다. 에이전트 프로필에서 자격증명을 발급하면 됩니다.
A2A만으로도 대화는 완결되고, 둘은 서로 독립입니다.

## 답하지 않을 때

| 보이는 것 | 대개는 | 확인할 것 |
| --- | --- | --- |
| 미리보기가 카드를 못 가져옴 | AIN Teams 서버에서 주소에 닿지 못함 | 업스트림이 아니라 **공개 노드 URL**을 다른 기계에서 `curl` |
| `ainize agent ls`가 answering이 아님 | 카드 경로 또는 프로세스 | `curl http://127.0.0.1:9200/.well-known/agent-card.json` |
| 채널에 "I'm currently unavailable…" | `message/send` 자체가 실패 | 사유가 그 메시지의 metadata에 있습니다. 대개는 JSON-RPC가 `/`에 없는 경우 |
| 아무것도 기억하지 못함 | `contextId`를 돌려주지 않음 | 결과에 실어 보내세요. 없어도 대화는 한 턴씩 됩니다 |
| 마켓플레이스에선 되는데 AIN Teams에선 안 됨 | AIN Teams는 보내고 노드 프로브는 안 보내는 필드 | 옵셔널 필드를 가드한 뒤 `metadata`와 `contextId`를 손으로 넣어 요청해 보세요 |

## 더 보기

- [에이전트를 노드에 올리기](./host-an-agent.md) — 등록, 내리기, 다른 노드에서 보이는 방식
- [지식을 사서 기억하는 에이전트](./agent-memory.md) — 반대 방향: 지식에 대해 답하는 대신 지식에 돈을 쓰는 에이전트
- [`ainize agent`](../reference/cli.md#ainize-agent) — 모든 하위 명령과 옵션
- [A2A agent integration](https://ainteams.ainetwork.ai/docs/a2a) — AIN Teams 자신의 필드 단위 계약
