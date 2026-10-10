---
title: Use a decision model (Cloudflare Clef)
summary: A decision model does not write text. It takes a situation and typed questions about it and answers each with a probability — through the ainize SDK's client.decide(), with your own API key.
---

# Use a decision model (Cloudflare Clef)

> This page is about the two decision models an Ainize node serves, `clef-flash` and `clef`. Calling the chat,
> speech and image models is [Call the model from your own code](./call-the-model.md). Teaching a model is
> [Teach by correcting the model](../tutorials/teach-in-chat.md).

## What a decision model is

A language model completes text. A **decision model** takes a `state` — any JSON that describes a situation —
and a set of **typed questions** about it, and answers each question with a **probability distribution**: not a
sentence to parse, but a number you can threshold, rank by or feed into the next step of a program. There is no
free text to clean up and no prompt to coax a format out of; the format is the API.

Three question types cover what a program usually needs to decide:

| Type | Asks | Answers with |
|---|---|---|
| `noul` | a yes/no question | `noul`: P(true), between 0 and 1 |
| `score` | how far along a graded scale | `score`: the index of the chosen grade in `criteria`, plus the distribution over the grades |
| `choice` | which of several named options | `choice`: the option's id, plus the distribution over the ids |

One tiny example of each, as questions in a request:

```json
{
  "outage":   { "type": "noul",   "instructions": "Is a service down?" },
  "severity": { "type": "score",  "instructions": "How severe is it?", "criteria": ["low", "medium", "high"] },
  "team":     { "type": "choice", "instructions": "Who should handle this?",
                "criteria": { "billing": "Payments or invoices", "technical": "Bugs or outages" } }
}
```

`instructions` tells the model what the question means; `criteria` is the graded scale (`score`, an ordered
list) or the options with a description each (`choice`, an object keyed by option id). Several questions in one
request are answered against the same `state` in one call.

## Call it from your code

Install the SDK and get an API key from the site — sign in with your wallet and create one on the
[Models page](/models); the page writes it into the snippet it shows you.

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
print(out.answers["outage"]["noul"])      # e.g. 0.93
print(out.answers["severity"]["score"])   # e.g. 2  → "high"
print(out.answers["team"]["choice"])      # e.g. "technical"
print(out.usage)
```

`connect()` returns the standard OpenAI client with one extra method, `decide()`, because a decision is the one
call OpenAI's client has no name for. `out` is a `DecideResult`: `.answers`, `.usage`, `.debug`, and the dict the
node sent (`out["answers"]`, `dict(out)`). A refusal raises `ainize.DecideError` with the node's `status_code`
and `code`. The TypeScript client (`@ainize/sdk`) has the same method: `await client.decide({ model, state,
questions })`.

### Inside an Ainize run

A script run from aindrive's ▶ button or deployed as a `script` project already has `AINIZE_URL` and
`AINIZE_API_KEY` in its environment — **your own key**, placed there because you are signed in; nothing goes in
the repo. The whole program is then:

```python
import os, ainize
client = ainize.connect(os.environ["AINIZE_URL"], api_key=os.environ["AINIZE_API_KEY"])
```

## The request on the wire

The SDK posts to the one endpoint a decision model answers at, `POST /v1/systemone`, with your key as a bearer:

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
  "debug": { "prompt": "…the exact prompt the model received…", "input_tokens": 212, "questions": 3 }
}
```

`/v1/chat/completions` does not serve decision models; a chat call with `model="clef"` is a 404.

## Seeing what the model saw

Pass `debug={"prompt": True}` and the answer carries `debug.prompt`: the exact prompt the model was given, built
from your `state` and `questions`. When an answer surprises you, read it first — a question whose `instructions`
read differently in context, a `state` that lost a field in serialization, criteria in an order you did not
intend. Leave it off in production; it costs response size, not model time.

```python
out = client.decide("clef-flash", state=..., questions=..., debug={"prompt": True})
print(out.debug["prompt"])
```

## Batching: many candidates

Two shapes, depending on what the model should compare.

**One candidate per call.** Each `state` is one candidate and the same questions are asked of each. Simple, and
every answer is independent; the cost is one call per candidate.

```python
scores = {name: client.decide("clef-flash", state=artwork, questions={"match": {"type": "noul", "instructions": f"Does this artwork match: {query}?"}}).answers["match"]["noul"]
          for name, artwork in artworks.items()}
```

**A list in `state`, one question per candidate.** Put the candidates into one `state` and ask one question
about each, keyed by candidate. One call; the model sees the whole set, so relative judgements ("which of these
is most…") become possible, and `choice` with the candidates as options is a ranking in a single answer.

```python
out = client.decide(
    "clef",
    state={"query": query, "candidates": artworks},
    questions={name: {"type": "noul", "instructions": f"Does candidate {name} match the query?"} for name in artworks}
              | {"best": {"type": "choice", "instructions": "Which candidate matches best?", "criteria": {n: a["title"] for n, a in artworks.items()}}},
)
```

Keep one `state` within what the model reads comfortably — a few dozen short candidates — and chunk beyond that.

## The two models

| Model | What it is for |
|---|---|
| `clef-flash` | Fast. Interactive use, large batches, anything where latency per call matters. |
| `clef` | The 27B model. Sharper on nuanced criteria and longer states; slower and costlier per call. |

Start with `clef-flash`; move a question to `clef` when its answers are the ones you keep second-guessing.

## Limits

Each call is metered by the number of questions it asks; a node queues a caller behind the throughput their
deposit buys (see [What you pay with](./call-the-model.md#availability-and-limits)). The refusals you can meet:

| Status / code | Meaning |
|---|---|
| 400 `invalid_request` | `model`, `state` or a non-empty `questions` object is missing |
| 401 `invalid_api_key` | the key is not one this node issued, or was revoked |
| 404 `model_not_found` | no node in reach serves that decision model |
| 429 `queue_too_deep` / `quota_exhausted` | wait the returned time |
| 503 `backend_unavailable` | the decision backend is down; retry later |

## Where to go next

- A complete, runnable example — ranking artworks against a description with `clef`:
  [`clef-artwork-search`](https://aindrive.ainetwork.ai/comcom/git/clef-artwork-search). Press ▶ on
  `art_search.py` in aindrive and it runs with your key.
- A decision model learns your criteria the way the chat model learns answers: [Teach](/teach) with your own
  question–answer pairs and publish the result as knowledge others can load.
