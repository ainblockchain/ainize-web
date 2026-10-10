---
title: 결정 모델 쓰기 (Cloudflare Clef)
summary: 결정 모델은 글을 쓰지 않습니다. 상황과 그에 대한 유형이 정해진 질문을 받아 각 질문에 확률로 답합니다 — ainize SDK의 client.decide()로, 내 API 키로.
source: en/how-to/decision-models-clef.md
source_sha256: bfc37ca391763bfe2564c45e1eda34fcd9116711fe34d38a830d6d32b86eda83
---

# 결정 모델 쓰기 (Cloudflare Clef)

> 이 문서는 Ainize 노드가 서빙하는 두 결정 모델 `clef-flash`와 `clef`에 관한 것입니다. 채팅·음성·이미지 모델을
> 호출하는 쪽은 [내 코드에서 모델 호출하기](./call-the-model.md), 모델을 가르치는 쪽은
> [모델을 고쳐 가르치기](../tutorials/teach-in-chat.md)입니다.

## 결정 모델이란

언어 모델은 글을 완성합니다. **결정 모델**은 상황을 묘사하는 임의의 JSON인 `state`와, 그에 대한 **유형이 정해진
질문들**을 받아, 각 질문에 **확률 분포**로 답합니다. 파싱해야 하는 문장이 아니라 바로 기준값과 비교하고, 정렬하고,
프로그램의 다음 단계에 넘길 수 있는 숫자입니다. 다듬어야 할 자유 텍스트도, 형식을 뽑아내려고 달래야 할 프롬프트도 없습니다.
형식이 곧 API입니다.

프로그램이 보통 결정해야 하는 것은 세 가지 질문 유형으로 덮입니다.

| 유형 | 묻는 것 | 답 |
|---|---|---|
| `noul` | 예/아니오 질문 | `noul`: P(참), 0과 1 사이 |
| `score` | 등급 척도 위의 어디쯤인지 | `score`: `criteria` 안에서 고른 등급의 인덱스, 그리고 등급들 위의 분포 |
| `choice` | 이름 붙은 여러 선택지 중 무엇인지 | `choice`: 선택지 id, 그리고 id들 위의 분포 |

각 유형의 작은 예 하나씩, 요청 안의 질문 모양으로:

```json
{
  "outage":   { "type": "noul",   "instructions": "Is a service down?" },
  "severity": { "type": "score",  "instructions": "How severe is it?", "criteria": ["low", "medium", "high"] },
  "team":     { "type": "choice", "instructions": "Who should handle this?",
                "criteria": { "billing": "Payments or invoices", "technical": "Bugs or outages" } }
}
```

`instructions`는 질문의 뜻을 모델에 알려 주고, `criteria`는 등급 척도(`score`, 순서가 있는 리스트) 또는 설명이 붙은
선택지들(`choice`, 선택지 id를 키로 하는 객체)입니다. 한 요청의 여러 질문은 같은 `state`에 대해 한 번의 호출로 답합니다.

## 내 코드에서 호출하기

SDK를 설치하고 사이트에서 API 키를 받습니다 — 지갑으로 로그인한 뒤 [모델 페이지](/models)에서 발급하면, 그 페이지가
보여주는 코드에 바로 채워집니다.

```bash
pip install ainize
```

```python
import os
import ainize

client = ainize.connect(os.environ.get("AINIZE_URL", "https://ainize.ai"), api_key=os.environ["AINIZE_API_KEY"])

out = client.decide(
    "clef-flash",
    state="The payment webhook is failing and customers cannot check out.",
    questions={
        "outage":   {"type": "noul",   "instructions": "Is a service down?"},
        "severity": {"type": "score",  "instructions": "How severe is it?", "criteria": ["low", "medium", "high"]},
        "team":     {"type": "choice", "instructions": "Who should handle this?",
                     "criteria": {"billing": "Payments or invoices", "technical": "Bugs or outages"}},
    },
)
print(out.answers["outage"]["noul"])      # 예: 0.93
print(out.answers["severity"]["score"])   # 예: 2  → "high"
print(out.answers["team"]["choice"])      # 예: "technical"
print(out.usage)
```

`connect()`는 표준 OpenAI 클라이언트에 메서드 하나, `decide()`를 더해 돌려줍니다. 결정은 OpenAI 클라이언트에 이름이
없는 유일한 호출이기 때문입니다. `out`은 `DecideResult`입니다: `.answers`, `.usage`, `.debug`, 그리고 노드가 보낸
dict 그대로(`out["answers"]`, `dict(out)`). 거절은 노드의 `status_code`와 `code`를 담은 `ainize.DecideError`를
던집니다. TypeScript 클라이언트(`@ainize/sdk`)에도 같은 메서드가 있습니다: `await client.decide({ model, state,
questions })`.

### Ainize 실행 안에서

aindrive의 ▶ 버튼으로 실행하거나 `script` 프로젝트로 배포한 스크립트의 환경에는 이미 `AINIZE_URL`과
`AINIZE_API_KEY`가 들어 있습니다 — 로그인되어 있기 때문에 놓인 **내 키**이고, 리포에는 아무것도 들어가지 않습니다.
그러면 프로그램 전체는 이것입니다:

```python
import os, ainize
client = ainize.connect(os.environ["AINIZE_URL"], api_key=os.environ["AINIZE_API_KEY"])
```

## 와이어 위의 요청

SDK는 결정 모델이 답하는 유일한 엔드포인트 `POST /v1/systemone`에, 내 키를 bearer로 붙여 보냅니다.

```http
POST /v1/systemone
Authorization: Bearer ainize-sk-…
Content-Type: application/json

{ "model": "clef-flash", "state": …, "questions": { … }, "debug": { "prompt": true } }
```

```json
{
  "model": "clef-flash",
  "answers": {
    "outage":   { "type": "noul",   "noul": 0.93 },
    "severity": { "type": "score",  "score": 2, "distribution": [0.02, 0.11, 0.87] },
    "team":     { "type": "choice", "choice": "technical", "distribution": { "billing": 0.08, "technical": 0.92 } }
  },
  "usage": { "questions": 3, "input_tokens": 212 },
  "debug": { "prompt": "…모델이 실제로 받은 프롬프트…", "input_tokens": 212, "questions": 3 }
}
```

`/v1/chat/completions`는 결정 모델을 서빙하지 않습니다. `model="clef"`로 채팅을 호출하면 404입니다.

## 모델이 본 것 보기

`debug={"prompt": True}`를 넘기면 응답에 `debug.prompt`가 실립니다: 내 `state`와 `questions`로 만들어져 모델에 주어진
정확한 프롬프트입니다. 답이 뜻밖일 때 먼저 읽어 보세요 — 문맥 속에서 다르게 읽히는 `instructions`, 직렬화되며 필드를
잃은 `state`, 의도하지 않은 순서의 criteria. 운영에서는 끄세요. 모델 시간이 아니라 응답 크기가 비용입니다.

```python
out = client.decide("clef-flash", state=..., questions=..., debug={"prompt": True})
print(out.debug["prompt"])
```

## 배치: 후보가 많을 때

모델이 무엇을 비교해야 하는지에 따라 두 가지 모양이 있습니다.

**호출 하나에 후보 하나.** `state` 하나가 후보 하나이고, 각 후보에 같은 질문을 합니다. 단순하고 답들이 서로 독립적이며,
비용은 후보당 호출 한 번입니다.

```python
scores = {name: client.decide("clef-flash", state=artwork, questions={"match": {"type": "noul", "instructions": f"Does this artwork match: {query}?"}}).answers["match"]["noul"]
          for name, artwork in artworks.items()}
```

**`state`에 리스트, 후보마다 질문 하나.** 후보들을 `state` 하나에 넣고 후보별로 질문 하나씩, 후보 이름을 키로 합니다.
호출은 한 번이고 모델이 전체 집합을 보므로 상대적인 판단("이 중 가장 …한 것은")이 가능해지고, 후보들을 선택지로 삼은
`choice`는 답 하나로 끝나는 랭킹이 됩니다.

```python
out = client.decide(
    "clef",
    state={"query": query, "candidates": artworks},
    questions={name: {"type": "noul", "instructions": f"Does candidate {name} match the query?"} for name in artworks}
              | {"best": {"type": "choice", "instructions": "Which candidate matches best?", "criteria": {n: a["title"] for n, a in artworks.items()}}},
)
```

`state` 하나는 모델이 편히 읽는 범위 — 짧은 후보 수십 개 — 안에 두고, 그 이상은 나누세요.

## 두 모델

| 모델 | 용도 |
|---|---|
| `clef-flash` | 빠릅니다. 대화형 사용, 큰 배치, 호출당 지연이 중요한 모든 곳. |
| `clef` | 27B 모델. 미묘한 criteria와 긴 state에 더 예리하고, 호출당 더 느리고 비쌉니다. |

`clef-flash`로 시작하고, 자꾸 되묻게 되는 답을 내는 질문만 `clef`로 옮기세요.

## 한도

호출마다 묻는 질문 수로 계량되고, 노드는 호출자를 그 예치가 사는 처리량 뒤에 줄 세웁니다([무엇으로
지불하는가](./call-the-model.md#지원-범위와-한도) 참고). 만날 수 있는 거절:

| 상태 / 코드 | 뜻 |
|---|---|
| 400 `invalid_request` | `model`, `state`, 또는 비어 있지 않은 `questions` 객체가 없음 |
| 401 `invalid_api_key` | 이 노드가 발급한 키가 아니거나 폐기됨 |
| 404 `model_not_found` | 닿는 노드 중 그 결정 모델을 서빙하는 곳이 없음 |
| 429 `queue_too_deep` / `quota_exhausted` | 응답의 재시도 시간만큼 기다리기 |
| 503 `backend_unavailable` | 결정 백엔드가 내려감; 나중에 재시도 |

## 다음으로

- 완전한, 바로 돌아가는 예 — `clef`로 묘사에 맞는 작품을 랭킹하기:
  [`clef-artwork-search`](https://aindrive.ainetwork.ai/comcom/git/clef-artwork-search). aindrive에서
  `art_search.py`의 ▶를 누르면 내 키로 실행됩니다.
- 결정 모델도 채팅 모델이 답을 배우듯 내 기준을 배웁니다. [Teach](/teach)에서 내 질문–답 쌍으로 가르치고, 결과를
  다른 사람이 불러올 수 있는 지식으로 공개하세요.
