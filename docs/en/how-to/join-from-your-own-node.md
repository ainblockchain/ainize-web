---
title: Join the network from your own node
summary: What a node outside this machine has to do to find the network, use knowledge from it, and sell knowledge back to it — including the case where nobody can reach you.
---

# Join the network from your own node

There is no registry to apply to and no account to make. Every node keeps its own ledger, gossip carries records
between peers, and "the marketplace" is what your ledger has heard about. `ainize.ai` is an entry point, not an
authority — joining is naming it once.

```
your node                                    peers (incl. ainize.ai)
  init --peer https://ainize.ai
       │ hello, then peer exchange
       └──────────────────────────────────▶  they learn about you
       ◀──────────────────────────────────   you learn about them, and their records
  teach train / teach publish
       │ gossip, seconds
       └──────────────────────────────────▶  your anchor appears in their catalogue
                                             verifiers run your benchmark themselves
       ◀──────────────────────────────────   attestations gossip back
  quorum met  ──▶  VERIFIED, on sale everywhere the anchor reached
```

## 1. Join

```bash
npm install -g ainize
ainize init --name joiner --port 3455 --peer https://ainize.ai --roles seller,serving
ainize start -d
```

```text
✓ node initialised at ~/.ainize/config.json
name        joiner
address     0x8fdAAE00D648273Be5AD9b7f7D6a19e1A6e94D04
listens on  127.0.0.1:3455  (this machine only)
ledger      local
roles       seller, serving
operator    password set — this node is claimed
the private key lives in ~/.ainize/config.json and this is the only copy — back it up now: `ainize keys backup <file>`
```

**One peer is enough.** Peer exchange finds the rest. Measured on a node whose only seed was `https://ainize.ai`:
within seconds it knew six peers and had nineteen ledger records it had never asked for.

```bash
ainize status
```

```text
joiner  http://localhost:3455  (pid 2621981)
address     0x8fdAAE00D648273Be5AD9b7f7D6a19e1A6e94D04
roles       seller, serving
ledger      local · local · 19 records · height 19
runtime     available · Qwen3.8-Flash-Next · hook ok
peers       6 known · 5 answered · 5 verifiers
patches     2 (0 verified)
quorum      2
blobs held  0 of 0 files on disk
```

Read two lines. **`peers`** — `known` is who you have heard of, `answered` is who actually replied; a peer that is
known and never answers is unreachable, not absent. **`patches`** — what your ledger has heard about, and how much of
it independent verifiers have passed.

> [!WARNING]
> **`config.json` holds the only copy of your node's private key.** It signs everything you publish, it is the
> address you are paid at, and there is no recovery. Changing it later orphans everything the old identity
> published.
>
> ```bash
> ainize keys backup ~/node-key.json --passphrase "a long passphrase you can remember"
> ```

Pass `--private-key <hex>` to `init` to bring an identity you already have instead of minting one.

## 2. Use knowledge from the network

Buying does not call the seller's model. It downloads the knowledge and loads it into **your** runtime, so the
seller's node is a source of bytes and not a service. That is why `serving` needs a runtime of its own:

```bash
ainize config set runtime.api http://localhost:8002
ainize stop && ainize start -d
```

`runtime available` in `ainize status` is the line that decides whether anything else works. Then:

```bash
ainize patch ls --status VERIFIED -q "<topic>"
ainize use <id>
ainize chat <id> "your question"
```

`ainize use` checks it is verified, quotes the price, pays, downloads and loads — no restart. `ainize chat` answers
with and without the knowledge, side by side, which is the only honest way to see what you bought.

### Buying something nobody has verified

A seller may allow its knowledge to be bought while it is still `ANNOUNCED`. The status does not change — it stays
`ANNOUNCED`, never `VERIFIED` — so what you get is an informed choice, not a relabelling:

```text
! taught-ainize-lifecycle100-2026-cf9a6f is ANNOUNCED, NOT verified — 0/2 independent attestations.
  · its benchmark score is the seller's own claim until a verifier reproduces it
  · nobody independent has checked whether loading it damages unrelated answers
  · watch it instead: ainize patch get taught-ainize-lifecycle100-2026-cf9a6f — quorum is 2
Buy taught-ainize-lifecycle100-2026-cf9a6f unverified, at your own risk? [y/N]
```

`--yes` answers it in a script, and the warning still prints. If the seller has **not** allowed it, the sale is
refused and says so rather than hanging:

```text
error: taught-ainize-lifecycle100-2026-cf9a6f is ANNOUNCED (verification 0/2) — not verified yet, so it cannot be
bought here; the verifiers usually answer within a few minutes.
```

## 3. Sell knowledge back

```bash
ainize config set teach.enabled true
ainize config set teach.backend gradient
ainize stop && ainize start -d

ainize teach dataset upload questions.csv
ainize teach train <dataset-id>
ainize teach jobs                      # watch it reach READY
ainize teach publish <job-id>
```

`teach.backend gradient` needs a trainer container and free GPU memory. Without it the backend is `stub`, and the
publish path refuses stub-backed work on purpose — a lesson nobody trained is not knowledge.

Two settings decide where the training runs, and both have to be right before the first lesson:

```bash
ainize config set runtime.gpus 0,1                  # the GPUs your model SERVES on
ainize config set teach.trainer.gpus 4,5,6          # the GPUs training may use — never the same ones
ainize config set runtime.patchDir /path/to/the/mailbox/of/runtime.api
```

**`runtime.patchDir` is the one people skip, and skipping it fails silently.** Knowledge is handed to a running
model through a directory it watches, and one machine can run several models each watching its own. Unset,
the node writes into a default that may belong to a *different* instance than `runtime.api` names — so
knowledge loads into a model nobody is asking, answers come from a model that never saw it, and every live
test reads as "this knowledge changed nothing". `ainize status` prints the mailbox with a warning when it had
to guess; that warning is the whole symptom.

Training and serving must not share GPUs: the trainer loads a second copy of the memory table and starves the
model every verification and live test depends on. The node refuses to start a lesson when the two sets
overlap, and pins the trainer to the GPUs it checked.

After `teach publish` it is out of your hands: the anchor gossips, each verifier applies your knowledge and runs
your benchmark **itself**, and signed attestations come back. Two independent passes and it is `VERIFIED`.

Two rules make the quorum mean something. You cannot verify your own knowledge, and **nodes sharing one runtime
count as one** — running the same model twice is not a second opinion.

## 4. If nobody can reach you

This is the part that used to fail silently, so read it before you publish.

Your anchor travels by gossip and arrives everywhere. Your knowledge **body** does not: it is fetched, and the
fetcher comes to you. Behind NAT, a firewall, or on a laptop, `ainize teach publish` succeeds, the catalogue shows
your knowledge, and no verifier can download it — so it sits at `ANNOUNCED` for ever and nothing anywhere reports an
error.

There are two ways out, and you want one of them before you publish.

**Be reachable.** If you have an address others can use, say so — nothing about it is discovered.

```bash
ainize init … --public-url https://my-node.example.com --public
```

`--public` binds every interface, so use it only behind a firewall or a proxy. The operator API needs a signature
from a key this node lists, so it is not open — but the port is reachable by anyone, and everything public is public.

**Or have a peer hold your body for you.** A node that opts in accepts your knowledge over `POST /p2p/blob/:sha`,
advertises it, and serves it to verifiers on your behalf. Your node offers its body to peers automatically right
after `announce`, and says plainly when nobody took it:

```text
no peer accepted the body of <id> — verifiers must reach http://localhost:3455 themselves to fetch it.
If this node is not reachable from outside, <id> will stay ANNOUNCED: ask a peer to set `p2p.relayBlobs true`.
```

A relay is not open storage and does not require trusting whoever uploads. The hash must name an anchor the relay
already knows from the gossiped ledger, the upload must be signed by **that anchor's author**, and the bytes are
rehashed on arrival and refused if they disagree with the hash the signed anchor already fixed.

On the holding side it is one setting, and a limit, because holding bytes for other people is a cost:

```bash
ainize config set p2p.relayBlobs true
ainize config set p2p.maxRelayBytes 104857600
ainize stop && ainize start -d
```

## What each role costs you

| role | what your node does | what it needs |
|---|---|---|
| `seller` | publishes and sells its own knowledge | somewhere its body can be fetched from — itself, or a relay |
| `verifier` | runs other nodes' benchmarks and signs attestations | a working runtime |
| `serving` | applies knowledge and answers | a runtime with the hook |
| `gateway` | the automatic-payment endpoints | — |

A node that only wants to buy and use knowledge needs `serving`, and nothing else.
