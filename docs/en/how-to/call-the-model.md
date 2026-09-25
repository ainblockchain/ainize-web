# Call the model from your own code

Install the Python SDK and authenticate with a wallet key stored in your environment.
`connect()` returns a standard OpenAI-compatible client. This login signature does not transfer funds.

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
