# Call the model from your own code

> Want to press one rather than read about it? The [Models page](/models) lists available models and providers. Chat, transcription,
> image and decision trials use the free routes; embeddings, speech and music require your API key. The detail
> page copies code for the selected model and current input, with explicit request limits.

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

client = ainize.connect(os.environ.get("AINIZE_URL", "https://ainize.ai"), api_key=os.environ["AINIZE_API_KEY"])
models = client.models.list().data
print([model.id for model in models])
```

**You get the key from the site.** Sign in with your AIN account or wallet. A model detail page can create a personal key and fill it into the snippet;
[Manage your keys](/me) also lets eligible accounts choose an organization. Your private key never leaves the
browser: a key that can sign a transfer has no business in a source file, a CI variable or a screenshot, and no
other model API asks you to put one in any of them.

A key saved in the browser belongs to the current account **and node**. The playground checks its current
status before a key-authenticated call. Disabled keys are kept so you can save their value, but are not used
in calls or copied request snippets. A confirmed revoked key is removed from the browser's saved-key display.
Use **Manage your keys** to see each key's identifier, organization and status. A lost response does not prove
that creation or revocation failed. The server cannot recover a lost secret from its hash.

Key creation saves the account, node, label, organization and a request identifier in this browser before
sending. Reloading either the model or account page checks that same request without issuing another key.
**Retry same request** cannot issue a second key for that identifier. **Cancel if unissued** prevents a delayed
request from issuing, but if issuance already happened the page reports that key instead of claiming cancellation.
If the key was issued but this tab never received a verified secret, manage or revoke the displayed identifier;
retrying cannot retrieve its secret. Save and clear a visible secret before creating another. Browser storage
and tab coordination must be available for these actions. Clearing browser data or switching devices loses this
browser's recovery record; the owned-key list remains available. This workflow requires a node with request-scoped
key creation; older nodes do not fall back to a potentially duplicate legacy issuance.

Key revocation records the selected identifier in your browser before sending the request. If the response is
lost, **Check status** only reads the current list. Reloading the account page resumes that check without
repeating revocation. If the same key is still present, **Retry revoking this key** is an explicit retry of that
identifier. A confirmed record stays visible until you close it. This record contains identifiers and labels,
not the key secret, and belongs to that account and node in this browser.

A program that already holds a wallet — an agent that also sends transactions — can pass `private_key=` instead
and be issued a key automatically. That is the exception, not the quickstart.

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

For streaming, pass `stream=True` and read nonempty choices. This short greeting disables reasoning so the token budget goes to the answer:

```python
stream = client.chat.completions.create(
    model="Qwen3.8-Flash-Next",
    messages=[{"role": "user", "content": "Say hello."}],
    max_tokens=32,
    stream=True,
    extra_body={"chat_template_kwargs": {"enable_thinking": False}},
)
for chunk in stream:
    if chunk.choices:
        print(chunk.choices[0].delta.content or "", end="", flush=True)
```

## Decision models (Clef)

`clef-flash` and `clef` are not chat models: they take a `state` and typed questions and answer with
probabilities, through one extra method on the same client — `client.decide(model, state=..., questions=...)`,
with `debug={"prompt": True}` to see the exact prompt the model received. The question types, batching and the
wire format are on their own page: [Use a decision model (Cloudflare Clef)](./decision-models-clef.md).

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
