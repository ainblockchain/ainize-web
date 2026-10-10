---
title: 결정 모델 쓰기 (Cloudflare Clef)
summary: 결정 모델은 글을 쓰지 않습니다. 상황과 그에 대한 유형이 정해진 질문을 받아 각 질문에 확률로 답합니다 — ainize SDK의 client.decide()로, 내 API 키로.
source: en/how-to/decision-models-clef.md
source_sha256: 54b50208eaa71a025bddbac51a7f531fd25c72124bec6a035907d2e2211f0a93
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
| `score` | 등급 척도 위의 어디쯤인지 | `score`: `criteria` 척도의 수치 점수(소수일 수 있음), 그리고 등급들 위의 분포 |
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

[AinCode](/code)에서는 실습 공간의 오프라인 패키지 캐시로 SDK를 설치합니다. `AINIZE_URL`은 실습 공간에 설정되어 있고, 호출은 로그인한 계정으로 연결됩니다. 각 Python 코드 블록을 `.py` 파일로 저장하고 `python 파일명.py`로 실행하세요. 아래 예제에는 연결 코드와 실습 입력값이 포함되어 있습니다. 파일과 진행 기록은 선택한 AinDrive Git 저장소에 저장하세요.

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
print(out.answers["severity"]["score"])   # 예: 1.96, "high"에 가까운 점수
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

같은 요청을 AinCode 터미널에서 바로 실행하세요. 실습 공간이 연결 정보를 제공합니다. 아래 명령은 답과 사용량을 보여 주고 전체 디버그 프롬프트는 출력하지 않습니다:

```bash
set -euo pipefail
: "${AINIZE_URL:?Open this example in your AinCode workspace}"
: "${AINIZE_API_KEY:?Your workspace supplies the model connection}"

curl -fsS "$AINIZE_URL/v1/systemone" \
  -H "Authorization: Bearer $AINIZE_API_KEY" \
  -H 'Content-Type: application/json' \
  --data-binary @- <<'JSON' | jq '{model, answers, usage, debug: {questions: .debug.questions}}'
{
  "model": "clef-flash",
  "state": "The payment webhook is failing and customers cannot check out.",
  "questions": {
    "outage": {"type": "noul", "instructions": "Is a service down?"},
    "severity": {"type": "score", "instructions": "How severe is it?", "criteria": ["low", "medium", "high"]},
    "team": {"type": "choice", "instructions": "Who should handle this?", "criteria": {"billing": "Payments or invoices", "technical": "Bugs or outages"}}
  },
  "debug": {"prompt": true}
}
JSON
```

```json
{
  "model": "clef-flash",
  "answers": {
    "outage": {
      "type": "noul",
      "noul": 0.93
    },
    "severity": {
      "type": "score",
      "score": 1.85,
      "confidence": 0.87,
      "legend": {
        "0": "low",
        "1": "medium",
        "2": "high"
      },
      "probabilities": {
        "0": 0.02,
        "1": 0.11,
        "2": 0.87
      }
    },
    "team": {
      "type": "choice",
      "choice": "technical",
      "confidence": 0.92,
      "probabilities": {
        "billing": 0.08,
        "technical": 0.92
      }
    }
  },
  "usage": {
    "input_tokens": 212,
    "output_tokens": 80,
    "latency_ms": 200
  },
  "debug": {
    "prompt": "...the exact prompt the model received...",
    "input_tokens": 212,
    "questions": 3
  }
}
```

점수·선택 질문의 확률은 `probabilities`에 담깁니다. 점수 확률의 키는 등급 인덱스이고, `legend`는 인덱스와 등급 이름을 연결합니다. 선택 확률의 키는 후보 ID입니다. `confidence`는 선택된 등급 또는 후보의 확률입니다. 토큰 수와 지연 시간은 `usage`에 있고, 디버그를 켜면 질문 수는 `debug.questions`에서 확인합니다. 위 숫자는 예시이며 호출마다 달라질 수 있습니다.

`/v1/chat/completions`는 결정 모델을 서빙하지 않습니다. `model="clef"`로 채팅을 호출하면 404입니다.

## 모델이 본 것 보기

`debug={"prompt": True}`를 넘기면 응답에 `debug.prompt`가 실립니다: 내 `state`와 `questions`로 만들어져 모델에 주어진
정확한 프롬프트입니다. 답이 뜻밖일 때 먼저 읽어 보세요 — 문맥 속에서 다르게 읽히는 `instructions`, 직렬화되며 필드를
잃은 `state`, 의도하지 않은 순서의 criteria. 운영에서는 끄세요. 모델 시간이 아니라 응답 크기가 비용입니다.

```python
import os
import ainize

client = ainize.connect(os.environ.get("AINIZE_URL", "https://ainize.ai"), api_key=os.environ["AINIZE_API_KEY"])

state = "The payment webhook is failing and customers cannot check out."
questions = {"outage": {"type": "noul", "instructions": "Is a service down?"}}

out = client.decide("clef-flash", state=state, questions=questions, debug={"prompt": True})
print(out.debug["prompt"])
```

## 배치: 후보가 많을 때

모델이 무엇을 비교해야 하는지에 따라 두 가지 모양이 있습니다.

**호출 하나에 후보 하나.** `state` 하나가 후보 하나이고, 각 후보에 같은 질문을 합니다. 단순하고 답들이 서로 독립적이며,
비용은 후보당 호출 한 번입니다.

```python
import os
import ainize

client = ainize.connect(os.environ.get("AINIZE_URL", "https://ainize.ai"), api_key=os.environ["AINIZE_API_KEY"])

query = "a small boat at sunset"
artworks = {
    "sunset": {"title": "Sunset boat", "description": "A small boat on the sea at sunset"},
    "city": {"title": "City street", "description": "Cars and buildings at midday"},
}

scores = {name: client.decide("clef-flash", state=artwork, questions={"match": {"type": "noul", "instructions": f"Does this artwork match: {query}?"}}).answers["match"]["noul"]
          for name, artwork in artworks.items()}
print(scores)
```

**`state`에 리스트, 후보마다 질문 하나.** 후보들을 `state` 하나에 넣고 후보별로 질문 하나씩, 후보 이름을 키로 합니다.
호출은 한 번이고 모델이 전체 집합을 보므로 상대적인 판단("이 중 가장 …한 것은")이 가능해지고, 후보들을 선택지로 삼은
`choice`는 답 하나로 끝나는 랭킹이 됩니다.

```python
import os
import ainize

client = ainize.connect(os.environ.get("AINIZE_URL", "https://ainize.ai"), api_key=os.environ["AINIZE_API_KEY"])

query = "a small boat at sunset"
artworks = {
    "sunset": {"title": "Sunset boat", "description": "A small boat on the sea at sunset"},
    "city": {"title": "City street", "description": "Cars and buildings at midday"},
}

out = client.decide(
    "clef",
    state={"query": query, "candidates": artworks},
    questions={name: {"type": "noul", "instructions": f"Does candidate {name} match the query?"} for name in artworks}
              | {"best": {"type": "choice", "instructions": "Which candidate matches best?", "criteria": {n: a["title"] for n, a in artworks.items()}}},
)
print(out.answers)
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
