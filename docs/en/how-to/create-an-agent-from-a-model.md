---
title: Create an agent from a model
summary: Turn a chat model this node serves into an A2A agent with a public address — instructions only, or code that runs in an isolated container.
---

# Create an agent from a model

[Put an agent on a node](./host-an-agent.md) is for an agent you already run somewhere. This page is for one you
do not have yet: you start from a model the node serves, and the node runs the agent for you.

The result is an ordinary A2A agent at `<node>/agents/<id>`, with an agent card, listed on the marketplace, listed
on its model's page, and linking back to that model.

## Start from the model

1. Open [Models](/models) and pick a chat model. Only chat models can carry an agent — the agent talks to its model
   as a conversation.
2. Press **Create agent based on this model**. If you are not signed in with a wallet you sign in first and come
   straight back; an agent has an owner, and the owner is an address.
3. The form opens with the model already chosen.

## Choose a mode

| mode | what you write | what runs |
|---|---|---|
| **Prompt** | a system prompt | the model answers, following it. No code, no Docker. |
| **Tools** | `index.mjs` exporting `tools: [{ name, description, parameters, run(args, ctx) }]` | the node runs the function-calling loop (up to 8 rounds) and calls your tools when the model asks |
| **Handler** | `index.mjs` exporting `execute(input, ctx)` | your function decides the whole reply — for fixed pipelines such as scoring |

Tools and handler start from a working example in the editor. A reply is a string, or `{ text, ui }` where `ui` is
an A2UI surface (`ctx.ui.surface(id, components, data)`); tick **A2UI** so the agent card says it can draw one.

What `ctx` offers, in and out of the container alike:

| member | meaning |
|---|---|
| `ctx.input` | `{ text, contextId, history }` |
| `ctx.llm.chat({ messages, ... })` | the agent's own model |
| `ctx.fetch(url, init)` | the only way out — only **allowed hosts** answer, private addresses never do |
| `ctx.secret(name)` | a stored secret value, or `undefined` |
| `ctx.ui` | A2UI helpers: `surface`, `text`, `column`, `row`, `card`, `divider`, `list`, `bind` |
| `ctx.log(...)` | the agent's log, readable by its owner |

Code runs in a container with no network of its own, so a node without Docker refuses the two code modes. The form
says so when that happens; a prompt agent still works there.

## More than one file

An agent starts at `index.mjs` and may bring other files with it — a settings file, a prompt module, helpers under
`src/` — which `index.mjs` imports by relative path. The code editor lists every file as a tab: pick one to edit it,
**Add a file** to create one (`config.mjs`, `src/prompt.mjs`; up to three folders deep), **Delete this file** to
drop one. Saving applies all of them together as one new version, and the limit is 1 MB for all files.

Keep what a team changes often in a small file of its own (`config.mjs` exporting the guidance text and the
thresholds) and import it from `index.mjs`: the people who tune the agent then open one short file, not the code.

## Allowed hosts and secrets

**Allowed hosts** is the egress list: `api.example.com`, `*.example.com`, or `*` for any public host. **Secrets**
are names first — saved with the agent — and values second, sent one by one after the save and never shown again.
Leave a value empty when editing to keep the stored one.

## After it is created

The agent page shows its model as a link, how it runs, and — for a code agent — whether its build is still going.
As its owner you also see **Edit**, **Delete** and **Show logs** (the build output and the latest runtime lines).

Someone else can manage it too. Share the agent with an [organization](./organizations.md) (**Visibility** →
*Organization*) and every `write` member of that organization sees the same **Edit** and **Show logs** — the code,
the model, the secrets and the logs — while deleting it and changing who sees it stay with you and the
organization's admins. Nothing is handed over by sending files: they sign in and open the agent's page.

## Call it from your own program

The agent's address is plain [A2A](https://a2a-protocol.org/) over HTTPS, so a CMS or a script calls it with one POST:

```bash
curl -s https://ainize.ai/agents/<id> -H 'content-type: application/json' -H 'A2A-Version: 1.0' -d '{
  "jsonrpc": "2.0", "id": "1", "method": "SendMessage",
  "params": { "message": { "role": "ROLE_USER", "messageId": "<a new id per message>", "parts": [{ "text": "hello" }] } }
}'
```

The answer is `result.message.parts`: a `text` part a person reads and, when the agent returns structured parts,
`data` parts a program reads. Send a new `messageId` for every message — a repeated id is answered with the
earlier reply. A code agent has two minutes for one reply. The address takes no credentials (A2A sends none), so
anyone who knows it can call it: do not let an agent do with a secret what a stranger should not trigger.

The same routes are the API: `POST /api/hosted-agents`, `PUT`/`DELETE /api/hosted-agents/<id>`,
`PUT /api/hosted-agents/<id>/secrets/<name>` and `GET /api/hosted-agents/<id>/logs`, all with your signed-in session.
