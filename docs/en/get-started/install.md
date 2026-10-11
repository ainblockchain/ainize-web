# Installation

## In AinCode on the web

Open [AinCode](/code) with your Ainize account and select your AinDrive practice repository. Node.js and the CLI are already installed in the workspace. Check the provided tools, then continue to [Quickstart](./quickstart.md):

```bash
node --version
ainize --version
ainize --help
```

The prepared AinCode practice environment routes package downloads and the official CLI source repository through the workspace gateway. It includes the native build tools and SQLite binary needed by the source build below. Keep your practice files and progress in your selected AinDrive Git repository; verify that saving and restoring the repository succeeds before relying on it as a backup.

## On your own machine

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
