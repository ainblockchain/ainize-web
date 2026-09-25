---
title: Call the model from your own code
summary: A node serves its model over the standard LLM API, so one line points an ordinary client at it. What you pay with is a deposit that is never spent — your share of the node's throughput is your share of what everyone asking at that moment has staked.
---

# Call the model from your own code

> This page is about **using** a node's model — chat, speech and images — from your own program.
> Teaching one is [Teach by correcting the model](../tutorials/teach-in-chat.md); buying somebody's knowledge is
> [Use knowledge someone else published](../tutorials/buy-and-apply.md).

A node serves its model over the LLM API that every client already speaks. That is the whole of the compatibility
claim: after one line, the code you write is the code you would have written against any hosted model, and the
rest of your program does not know this node exists.

```bash
pip install ainize          # Python
npm install @ainize/sdk     # TypeScript
```

```python
import ainize

client = ainize.connect("http://127.0.0.1:24800", private_key="0x…")
```

`connect()` returns the **standard client object**, not a wrapper and not a subclass — its own methods,
parameters and exception types, unchanged. Swapping a node for a hosted provider, or back, is one line either
way. (Concretely: in Python the return value is an `openai.OpenAI`, because that package is the de facto client
for this API. Nothing else about your code refers to it.)

```python
>>> [m.id for m in client.models.list().data]
['qwen2.5-7b-instruct', 'qwen3-asr', 'qwen-image-2512']
```

Ask the node what it serves rather than assuming; a node advertises exactly what its operator configured, and one
serving only a language model lists only that.

## The three modalities

```python
# chat
out = client.chat.completions.create(
    model="qwen2.5-7b-instruct",
    messages=[{"role": "user", "content": "In one sentence: what is a GPU good at?"}],
)

# speech to text
with open("speech.flac", "rb") as f:
    client.audio.transcriptions.create(model="qwen3-asr", file=f).text

# images
img = client.images.generate(model="qwen-image-2512", prompt="a single red maple leaf on white paper")
png = base64.b64decode(img.data[0].b64_json)
```

Streaming is the ordinary stream of this API, and every frame you receive has a choice in it — the documented
`chunk.choices[0]` loop is safe:

```python
for chunk in client.chat.completions.create(model="qwen2.5-7b-instruct", messages=[…], stream=True):
    print(chunk.choices[0].delta.content or "", end="")
```

Transcription and image generation run on their own hardware and their own queues. A long completion does not
delay a voice note, and a large deposit does not let one caller crowd out image work with audio.

## What you pay with

A **deposit**, not a charge per token. Send AIN or sAIN to the node; the operator holds it staked. Your share of
the node's throughput is your share of what everyone *asking at that moment* has deposited.

Three things follow, and they are unlike every other model API you have paid for:

- **The principal is never spent.** The operator's revenue is the staking yield on it. Calling the model does not
  draw it down, so there is no balance to top up, no invoice and no per-token price.
- **An idle deposit costs the people who are active nothing.** An address that is not calling has nothing in the
  queue and no claim on it. You are not diluted by depositors who stopped using the node.
- **Your share is relative, so it moves.** If the only other caller stops, your share rises without you doing
  anything. If ten arrive, it falls. A deposit buys a **ratio, not a rate** — which is also why the node can never
  promise you capacity it does not have.

```python
ainize.deposit_address("http://127.0.0.1:24800")      # where to send, and which chains are watched
ainize.await_deposit(url, tx_hash, api_key=client.api_key)
```

Send only on a chain the node watches — that call tells you which. AIN sent anywhere else arrives and is never
credited, and nothing on-chain will tell you so.

The library **never signs a transfer.** It tells you where to send and waits for the node to notice; moving funds
stays with the wallet you already trust. Signing a login is a far smaller thing to hand a private key to than
signing a transfer, and nothing at the import line would show a caller the difference.

A deposit is not credited the moment it lands. The node waits out its own confirmation depth, so a transaction a
block explorer already shows is not yet a share. What it is **worth** is fixed when it is credited, at the
staking exchange rate then — not at the rate when you sent it. That rate rises as rewards accrue, so the same
amount of AIN buys slightly fewer shares later.

**There is no withdrawal.** A deposit is the purchase of a permanent share.

## What the node tells you about your share

```json
{
  "address": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
  "deposited_shares": "1000000000000000000",
  "total_deposited_shares": "4000000000000000000",
  "share_of_active": 1,
  "share_of_deposited": 0.25
}
```

Amounts are **decimal strings**, not numbers: a share carries 18 decimals and a JSON number would round it. Parse
with `int()` or `BigInt()`, never with a float.

The two fractions differ here, and the difference is the point. `share_of_deposited` is 0.25 — a quarter of every
deposit ever made. `share_of_active` is **1**, because whoever holds the other three quarters is not calling right
now. `share_of_active` is the number that decides your wait.

## When the node is busy

A node runs one language-model request at a time. That is the hardware, not a policy, and it is why a deposit buys
a place in a queue rather than a requests-per-second allowance: a rate limit would have to be chosen before anyone
knew who would show up, and would either oversubscribe the node or waste it.

**There is no error meaning "your share is too low."** A small share means a longer wait, never a refusal. The node
refuses only when it cannot honestly promise to start you at all:

```json
{ "error": { "code": "queue_too_deep" }, "share": 0.02, "position": 37, "retry_after": 190 }
```

Three things you could change, and the numbers to decide between them: wait, deposit more, or ask for less. A bare
429 would leave you unable to tell a briefly busy node from one you will never be served by.

A caller who has deposited **nothing** is still served — last, not never, so a node nobody else is using answers
anyone. What runs out is the free hourly allowance, which returns as `quota_exhausted` with the time it resets.

## Errors

Every error is in this API's standard shape, so your client raises its own typed exception rather than a bare HTTP
failure.

| Code | Status | What it means |
|---|---|---|
| `invalid_api_key` | 401 | No key, or one that was revoked. Sign in again. |
| `model_not_found` | 404 | This node does not serve that model. |
| `invalid_request` | 400 | A field the node cannot honour. The message names it. |
| `queue_too_deep` | 429 | The node cannot promise to start you soon at your current share. |
| `quota_exhausted` | 429 | No deposit, and the free allowance is spent. |
| `backend_unavailable` | 503 | The model is down or restarting — distinct from being queued. |

A field this node cannot honour is **refused, not ignored**: `n: 4` is a 400 rather than one answer presented as
four, because silently dropping it would hand you three answers that never existed.

## For operators

A node serves this API only when its `backends` block says what it serves, and accepts deposits only when its
`deposits` block says where they land. Both are declared rather than discovered, so a node advertises what you
configured rather than whatever happened to be running.

The staking contract address and the receiving address have **no defaults** and the node refuses to start without
them. Neither mistake is visible at runtime — a node watching the wrong address simply never sees a transfer,
which looks exactly like nobody having deposited yet.
