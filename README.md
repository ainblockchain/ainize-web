# Ainize web

Next.js frontend and API proxy for [Ainize](https://github.com/ainblockchain/ainize).
The web process forwards `/api`, `/agents`, `/x402` and `/p2p` to `AINIZE_NODE_URL`.
Run the node separately; its default API port is 3402.

```bash
npm ci
AINIZE_NODE_URL=http://127.0.0.1:3402 npm run dev
npm test
npm run typecheck
npm run build
```

Development runs on port 3000. Production uses a standalone Next.js server behind Nginx;
see [deployment](deploy/README.md). `deploy/deploy-web.sh <ref>` deploys a committed ref
only after tests, type checking and the build pass.

## User workflow

Install the CLI with `npm install -g ainize`. Knowledge application needs a compatible
runtime and patch hook. Teaching needs an enabled trainer. IDs, files and peers below
are placeholders: use your node's actual catalogue and configuration.

| Step | CLI | Web |
|---|---|---|
| 1 | `npx ainize init --name my-node`<br>`npx ainize start` | `https://ainize.ai/` |
| 2 | `ainize chat <knowledge-id> "your question"` | `https://ainize.ai/chat` |
| 3 | `ainize patch ls --node http://their-node:3402 --status VERIFIED -q "<topic>"`<br>`ainize login && ainize use <id>` | `https://ainize.ai/explore` |
| 4 | `ainize teach train ./questions.jsonl --effort quick --wait` | `https://ainize.ai/teach` |
| 5 | `ainize publish ./knowledge.npz --name "My knowledge" --model Qwen3.8-Flash-Next --benchmark ./bench.json --price 25` | `https://ainize.ai/teach/mine` |
| 6 | `ainize peers add http://a-verifier-node:3402` | `https://ainize.ai/network` |
| 7 | `ainize use <your-id>`<br>`ainize wallet` | `https://ainize.ai/ledger` |
| 8 | `ainize use <your-id>`<br>`ainize dataset get <your-id> -o questions.jsonl`<br>`ainize teach train ./questions.jsonl --patch <your-id> --wait` | `https://ainize.ai/explore` |

A ready lesson can also be published with `ainize teach publish <job-id>` and its required
consent flags. Review prices before buying and verification evidence before relying on an answer.

## Documentation

Edit `docs/en` and `docs/ko`, then run `npm run gen`. When changing a translation, update
its `source_sha256` to the SHA-256 of the English file. `npm test` validates navigation,
links and translation freshness; `npm run gen:check` checks the generated inline modules.

The reference for an installed CLI is `ainize <command> --help`; the running node's
API contract is `/api/openapi.json`.
