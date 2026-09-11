---
title: Installation
summary: Get the `ainize` command onto your machine from a checkout of this repository, and learn where a node keeps itself.
---

# Installation

At the end of this page you have one command, `ainize`, and a directory it will keep a node in. Nothing here needs a
GPU or a model — that comes on the next page. Ten minutes, most of it waiting for `npm install`.

> [!NOTE]
> Every block below is a command that was run and the output it printed. The one edit is to absolute paths: the
> machine this was recorded on keeps its scratch directories somewhere long and uninteresting, so a node's home
> directory appears as `<AINIZE_HOME>` and a file beside it as `~/…`. Nothing else is changed, and nothing is invented.

## First, Node 24

Ainize is written for Node 24 and the repository says so out loud — the root `package.json` carries
`"engines": { "node": ">=24" }`, and every workspace under `packages/` is built by it. Check what you have:

```bash
node --version
```

```text
v24.20.0
```

If that prints a lower number, install Node 24 before going on; `npm` arrives with it, so there is nothing else to
fetch. If you installed Node under your home directory instead of system-wide, its `bin` has to be on your `PATH`
before `node` and `npm` resolve to that copy:

```bash
export PATH="$HOME/.local/node/bin:$PATH"
```

## Install it

```bash
npm install -g ainize
```

```text
added 206 packages in 1m

46 packages are looking for funding
  run `npm fund` for details
```

```bash
ainize --version
```

```text
0.1.0
```

That is the whole installation. One command named `ainize` is now on your `PATH`, and it is the same program the
node runs and the site calls.

`npm` prints a warning about install scripts on the way past — `secp256k1`, `keccak` and `better-sqlite3` build
native code. They are the signing and storage libraries a node needs, and the install works without them by falling
back to slower JavaScript, so the warning is not a failure.

> [!NOTE]
> **Anything that tells you to clone a monorepo and `npm link -w packages/cli` is out of date.** That was the only
> route before `ainize` was published, and the workspace it names no longer exists — the packages live in their own
> repositories now ([ainize-cli](https://github.com/ainblockchain/ainize-cli),
> [ainize-node](https://github.com/ainblockchain/ainize-node), [ainize-core](https://github.com/ainblockchain/ainize-core)).
> An older page may also mention a second command called `ngram`, the historical name. The published package
> installs `ainize` and nothing else.

## Build it from source instead

Only if you mean to change it. The published package is built from the same tree.

```bash
git clone https://github.com/ainblockchain/ainize-cli
cd ainize-cli
npm install
npm run build
npm link
```

`npm link` puts a symlink in your npm global `bin` pointing back into your checkout, so a later `npm run build`
updates the command in place with no reinstall step. It replaces whatever `npm install -g ainize` put there; `npm
unlink -g ainize && npm install -g ainize` puts the published one back.

## Where a node lives: `AINIZE_HOME`

A node keeps everything it is in a single directory: its key, its settings, its ledger and the knowledge it holds.
`AINIZE_HOME` names that directory. Leave it unset and it is `~/.ainize`; set it, and that is the node you are talking
to for the rest of the session.

```bash
export AINIZE_HOME=~/nodes/quickstart
```

One directory is one node. Two nodes on one machine means two directories and two ports — which is exactly how the
transcript on the next page was recorded. The `--home` option does the same thing for a single command
(`ainize --home ~/nodes/other status`), and every command accepts it.

`ainize init` creates the directory, and straight afterwards it holds only what `init` itself wrote:

```bash
ls -1 "$AINIZE_HOME"
```

```text
config.json
data
```

The rest arrive as the node is used, so the same listing on a node that has been started and logged in to has five
entries rather than two:

```text
cli.json
config.json
data
node.log
node.pid
```

| Entry | Written by | What it is |
|---|---|---|
| `config.json` | `ainize init` | The node itself — its private key and address, its port and roles, which ledger it writes to, its prices, and where its serving model is. Every key in it is listed in the [configuration reference](../reference/config.md). |
| `data/` | the node, as it runs | Ledger records, the bodies of the knowledge it holds, datasets, logs of who bought what. |
| `node.log` · `node.pid` | `ainize start --detach` | Where a background node writes and how `ainize stop` finds it again. |
| `cli.json` | `ainize login` | Your operator token, and the node URL the CLI talks to. Not the node's identity — this one you can delete and remake. |

> [!WARNING]
> **`config.json` holds the only copy of the node's private key**, and that key owns everything the node publishes,
> its balance and its payouts. There is no recovery and no reset. Back it up before you publish anything:
>
> ```bash
> ainize keys backup ~/node-key.json --passphrase "a long passphrase you can remember"
> ```
>
> ```text
> ✓ node key of quickstart (0x9d9da8f0C939c0cE4909ef44B73BeDffF740e77A) written to ~/node-key.json
>   encrypted (scrypt + aes-256-gcm) — without the passphrase this file is useless, including to you
>   restore it on another machine with `ainize keys import ~/node-key.json`
> ```

## Next

You have the command; the next page starts a node with it, points it at a model, and watches an answer change:
[Quickstart](./quickstart.md).

If instead you want to know what a flag does, that is the other half of this site — the
[CLI reference](../reference/cli.md) lists every command and option, generated from the CLI's own declarations, and
the [configuration reference](../reference/config.md) does the same for the file you just read about.
