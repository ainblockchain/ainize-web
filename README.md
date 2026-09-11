# ainize-web — the explorer

The frontend of [Ainize](https://github.com/ainblockchain/ainize), a **Collaborative Foundation Model**:
one base model whose memory is taught by many people, in pieces, in the open.

This package is the window onto that network — the landing page, the knowledge catalogue, the node map,
the teacher and verifier pages, and the public sale record. It is a static build with **no build-time
dependency on any other Ainize repository**; at runtime it is handed the URL of a node and shows what
that node's peers can see.

```bash
npm install && npm run build      # dist/ — serve it anywhere
npm run dev                       # vite dev server
```

Whoever runs an explorer runs a node too: the explorer's view of the network is its node's view,
gathered peer-to-peer. See [ainize-node](https://github.com/ainblockchain/ainize-node).

---

## The loop — eight steps, in the order they happen

This is the whole ecosystem: run a node, meet the base model, use somebody's knowledge, teach your own, publish it,
watch other nodes verify it, watch somebody else buy it — and watch them build on it and publish again, which is
where the next person's step 3 comes from. **The landing page draws these same eight steps, with these same commands
and these same routes** (`packages/web/src/components/public/Lifecycle.tsx`); `packages/web/test/lifecycle.test.ts`
fails the build if this table and that diagram ever drift apart.

```text
   +----------------------------------------------------------------------------------+
   |  what they published is what the NEXT person finds: they start at the top        |
   |  and meet it at step 3 -- so it goes around again                                |
   v                                                                                  |
      [you]           1  Run a node                                                   |
      [your node]     2  The base model answers                                       |
      [you]           3  Find someone's knowledge and use it   <-- somebody's step 8  |
      [you]           4  Teach it something it gets wrong                             |
      [you]           5  Publish it                                                   |
      [the network]   6  Other nodes verify it before it sells                        |
      [someone else]  7  Someone else uses yours                                      |
      [someone else]  8  They add to it and publish again ----------------------------+
```

| # | Who | Step — and what it needs | One line | On this node |
|---|---|---|---|---|
| 1 | you | **Run a node.** The same process is the marketplace site and the CLI. *Clone this repo and `npm install && npm run build` first — there is no public npm package. The key `init` writes into `config.json` **is** the node, and that file is the only copy.* | `npx ainize init --name my-node`<br>`npx ainize start` | `/` — the node serves the site itself<br>`http://localhost:3402/` |
| 2 | your node | **The base model answers.** With nothing loaded, that answer is the "before" column of a live test. *No command asks the bare model on its own: `chat` always answers before **and** after. In the browser the live test is free and is not a purchase.* | `ainize chat <knowledge-id> "your question"` | `/` → Live test<br>`http://localhost:3402/chat` |
| 3 | you | **Find someone's knowledge and use it.** Verified? → pay → download → load into the running model, no restart. *Buying is the operator's action (`ainize login` first) and only knowledge that finished verification is on sale; the browser live-tests it free but does not buy it.* | `ainize patch ls --node http://their-node:3402 --status VERIFIED -q "<topic>"`<br>`ainize login && ainize use <id>` | `/` → Explore knowledge → a knowledge page → Buy<br>`http://localhost:3402/explore` |
| 4 | you | **Teach it something it gets wrong.** Your questions and their right answers become a lesson the node trains and then side-effect-checks. *Only on a node whose operator switched teaching on — off by default. No account: a teaching key is the whole identity, and losing the backup loses the lesson.* | `ainize teach train ./questions.jsonl --effort quick --wait` | `/` → Teach → Upload your dataset<br>`http://localhost:3402/teach` |
| 5 | you | **Publish it.** *A data provider publishes in the browser — there is no CLI for that path yet; the line here is the operator's route for a file already on the node's machine. Publishing sends a **path, not bytes**, so the node that sells the knowledge is the node holding the file. The benchmark is required and its questions and expected answers become public.* | `ainize publish ./knowledge.npz --name "My knowledge" --model Qwen3.8-Flash-Next --benchmark ./bench.json --price 25` | `/teach` → My datasets and lessons → the lesson → Publish<br>`http://localhost:3402/teach/mine` |
| 6 | the network | **Other nodes verify it before it sells.** *Publishing is not selling: two independent verifier nodes must load it into the real model and score it, your own attestation is refused and never counted, and this repo ships no bootstrap peer list — so a node with no peers lists nothing.* | `ainize peers add http://a-verifier-node:3402` | `/` → Network — the nodes that verify<br>`http://localhost:3402/network` |
| 7 | someone else | **Someone else uses yours.** They pay over x402 (a wallet in AIN, or node credit) and the file comes from your node. *First line is theirs, second is yours. Your node must stay reachable and still hold the body; any verifier's challenge stops the sale until it is re-run.* | `ainize use <your-id>`<br>`ainize wallet` | `/` → Public record — the sale, signed and permanent<br>`http://localhost:3402/ledger` |
| 8 | someone else | **They add to it and publish again.** The new lesson records yours as its parent and shares revenue with you on every sale. *Line 1 is the acquisition and it is required — you cannot teach on top of knowledge your node does not hold. Line 2 only works if you published the questions as readable. The child stays tied to the parent: buying or applying it without the parent is refused.* | `ainize use <your-id>`<br>`ainize dataset get <your-id> -o questions.jsonl`<br>`ainize teach train ./questions.jsonl --patch <your-id> --wait` | `/` → Explore knowledge → a knowledge page → Origins & derivatives<br>`http://localhost:3402/explore` |

Then step 8's knowledge is step 3's catalogue entry for the next person, and it goes around again.

The web UI is the same node: **http://localhost:3402** (Explore · Live test · Teach · Public record · Docs & API) — one process,
no separate web app to deploy. The full API/CLI reference is served by the node itself: `/docs` (web),
`/api/openapi.json` (OpenAPI 3.1), `ainize --help`.

