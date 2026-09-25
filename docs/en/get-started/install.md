# Installation

Use Node.js 24 or newer. Install the published CLI:

```bash
node --version
npm install -g ainize
ainize --help
```

## Build from source

For CLI development:

```bash
git clone https://github.com/ainblockchain/ainize-cli
cd ainize-cli
npm ci
npm run build
npm link
```

## Node files

`--home` or `AINIZE_HOME` selects a node directory; the default is `~/.ainize`.
Use a separate directory and port for each node.

| File | Purpose |
|---|---|
| `config.json` | Identity, runtime and network settings. Contains the private key; back it up securely. |
| `data/` | Ledger, datasets and knowledge files. |
| `node.log`, `node.pid` | Background process log and PID. |
| `cli.json` | CLI session. |
| `teaching-key.json` | Identity that owns CLI lessons. Back it up before teaching. |

The web application is deployed separately from the node. Use [ainize.ai](https://ainize.ai)
or run [ainize-web](https://github.com/ainblockchain/ainize-web) against your node.

Next: [Quickstart](./quickstart.md).
