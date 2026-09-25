# Call the model from your own code

> Want to press one rather than read about it? The [Models page](/models) lists what this node serves and runs
> all three in the browser, with no key and no deposit — then hands you this same code with the model filled in.

> This page is about **using** a node's model — chat, speech and images — from your own program.
> Teaching one is [Teach by correcting the model](../tutorials/teach-in-chat.md); buying somebody's knowledge is
> [Use knowledge someone else published](../tutorials/buy-and-apply.md).

A node serves its model over the LLM API that every client already speaks. That is the whole of the compatibility
claim: after one line, the code you write is the code you would have written against any hosted model, and the
rest of your program does not know this node exists. `connect()` returns a standard client; the signature it asks
for is a login and moves no funds.

```bash
pip install ainize
```

```python
import os
import ainize

client = ainize.connect("https://ainize.ai", private_key=os.environ["AINIZE_PRIVATE_KEY"])
models = client.models.list().data
print([model.id for model in models])
```

## Chat

Select a chat model returned by this node. The public deployment serves `Qwen3.8-Flash-Next`.

```python
response = client.chat.completions.create(
    model="Qwen3.8-Flash-Next",
    messages=[{"role": "user", "content": "What is a GPU? Answer in one sentence."}],
    max_tokens=128,
)
print(response.choices[0].message.content)
```

For streaming, pass `stream=True` and read nonempty choices:

```python
stream = client.chat.completions.create(
    model="Qwen3.8-Flash-Next",
    messages=[{"role": "user", "content": "Say hello."}],
    max_tokens=32,
    stream=True,
)
for chunk in stream:
    if chunk.choices:
        print(chunk.choices[0].delta.content or "", end="", flush=True)
```

## Availability and limits

Models and modalities are configured per node. Audio transcription and image generation require
separate operator-provided backends; they are not enabled by installing the SDK.
The TypeScript client is available as `@ainize/sdk`.

| Status / code | Action |
|---|---|
| 401 `invalid_api_key` | Authenticate again. |
| 404 `model_not_found` | Check the model list and exact ID. |
| 400 `invalid_request` | Correct the named field or reduce the request. |
| 429 `queue_too_deep` / `quota_exhausted` | Respect the returned retry time. |
| 503 `backend_unavailable` | Retry after the model service recovers. |

Deposits are an optional node feature, not a requirement for this example. Only use deposit helpers
on a node whose operator has configured and documented its receiving address, supported chains
and terms. The public chat example does not require sending AIN.

## Operators

The node needs a `backends` entry with its model IDs, modality and upstream URL.
The reverse proxy must forward **all `/v1/*` routes**, including authentication, and preserve streaming.
Ainize web uses `AINIZE_NODE_URL` to locate that node.
