---
title: Put an agent on a node
summary: Give an A2A agent you already run a public address, an agent card and a place on the marketplace — without opening a port of your own.
---

# Put an agent on a node

You have an agent running on `127.0.0.1:9200`. It speaks [A2A](https://a2a-protocol.org/), it answers
`message/send`, and it serves an agent card. What it does not have is an address anyone else can use, and that is
usually the point where people start looking for a server to rent.

A node is that address. It gives a registered agent a public URL, serves its card at the well-known path, and
tells the nodes it is connected to that the agent exists — so the agent appears on their marketplace as well as
yours. The agent process never moves and never needs an address of its own.

Everything below is one node and one agent. It assumes a node that already starts and answers `ainize status`; if
you do not have one yet, [join the network from your own node](./join-from-your-own-node.md) first.

## Register it

```bash
ainize agent add donga-desk --upstream http://127.0.0.1:9200
```

`donga-desk` is the id, and it is the URL segment: the agent is now at `<your node>/agents/donga-desk`. `--upstream`
is where your process listens, and it is **never published** — it is how the node reaches the agent, and on most
machines it is an address that means nothing to anyone else.

```bash
ainize agent ls
```

```text
donga-desk   answering   5 skills   https://ainize.ai/agents/donga-desk
```

`answering` is not a claim from the registration. The node fetched the agent's card, which is the one request every
A2A client makes first: an agent whose card cannot be fetched is not reachable in any sense a caller cares about,
whatever its process table says.

## What a caller gets

The card, at the path every A2A client tries:

```bash
curl -s https://ainize.ai/agents/donga-desk/.well-known/agent-card.json | jq '{name, url}'
```

```json
{ "name": "동아사이언스 운영 데스크", "url": "https://ainize.ai/agents/donga-desk" }
```

The `url` is the node's, not `127.0.0.1:9200`. A card that kept the agent's own address would send every client to
its own machine, so the node rewrites it on the way out — which is what lets a stock A2A client, one that knows
nothing about any of this, follow the card and work.

Then a call, the same JSON-RPC a workspace sends:

```bash
ainize agent call donga-desk "오늘 파이프라인 상태 어때?"
```

`ainize agent card` and `ainize agent call` both go through the public path rather than to `--upstream`, on
purpose: what they exercise is what a stranger gets.

## Taking it down

```bash
ainize agent off donga-desk     # keep the registration, stop publishing the address
ainize agent on  donga-desk     # publish it again
ainize agent rm  donga-desk     # forget it entirely
```

`off` is the one to use while you are working on an agent. A half-built agent with a live address is worse than no
address: the card still resolves, so a caller reads the failure as their own.

## It appears on other nodes too

Your node advertises its agents to the nodes it is connected to, on the gossip round that was already happening.
Those nodes list it, and a visitor there calls it through **their** node, which forwards to yours:

```text
visitor's browser  ->  their node  ->  your node  ->  your agent
```

Two consequences worth knowing. Your agent is reachable from a marketplace even though your node is on a home
network with nothing forwarded — the hop that matters is node-to-node, and your node made that connection
outbound. And the address a visitor is given belongs to the node they are on, never to yours: what is published is
that your node runs it, by name and address, not where your node lives.

An id is not an identity. If two nodes run an agent called `donga-desk`, only one of them gets the short address on
any given node, and the other is still reachable at the peer-qualified path — `/sam/<peer>/a2a/donga-desk` — which
always names exactly one.

## What the node does not do

It does not run your agent. An agent is a separate process with its own dependencies, its own failure modes and its
own appetite for a GPU, and a node that supervised those would take your agent down with it every time it
restarted. Start it the way you start anything else — a service, a container, `node server.js` — and register the
address.

It also does not authenticate callers on your behalf. A2A sends no authentication, so the address is public by
construction: anyone who can reach it can call it. The node adds a body cap and a per-IP rate limit in front of
every agent, and your agent should enforce its own limits too. Neither layer is load-bearing alone.

## See also

- [`ainize agent`](../reference/cli.md#ainize-agent) — every subcommand and option
- [`agents`](../reference/config.md) in the configuration reference — the same registration in `config.json`
- [Run a node others can reach](./reachable-node.md) — if you want your node to be the address people are given
