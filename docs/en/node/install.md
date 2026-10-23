---
summary: Install the ainize CLI on your own machine, or build it from source, to run a node there.
aincode: false
---

# Install the CLI on your machine

You need this only to run a node of your own. Writing code and deploying it needs nothing installed:
[AinCode](../get-started/install.md) already has the CLI.

## Install the published CLI

Use Node.js 24 or newer:

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

Next: [Start a local node](./quickstart.md).
