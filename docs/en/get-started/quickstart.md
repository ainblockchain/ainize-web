# Quickstart

Start a local node, inspect it, then connect it to a compatible model. Install the
[CLI](./install.md) first. These commands use a new home so they do not change another node.

## Start a node

```bash
export AINIZE_HOME="$HOME/ainize-quickstart"
ainize init --name quickstart --port 3694 --roles seller
ainize start -d
ainize status
ainize login
ainize wallet
```

A local ledger starts with test CREDIT. It is not an AIN mainnet balance.
`ainize login` on the node's machine signs with that node's key.

## Connect a model

Knowledge loading needs a compatible runtime **and its patch hook**, not just a working chat API.
For the Qwen3.8 runtime, start the serving container with `ENGRAM_HOOK=1` and `MTP=0`.
Its patch directory must be mounted into that container and match `runtime.patchDir`.
Replace the paths below with your runtime checkout and mailbox:

```bash
ainize config set runtime.api http://127.0.0.1:8000
ainize config set runtime.repo /path/to/qwen3.8
ainize config set runtime.patchDir /path/to/patch-mailbox
ainize config set roles seller,serving
ainize stop
ainize start -d
ainize status --check
```

Continue with live tests only when runtime status is `available` and the hook is working.
A model endpoint returning a model list alone does not prove patches can load.

## Find and use knowledge

```bash
ainize peers add https://ainize.ai
ainize patch ls --status VERIFIED
ainize chat --list
```

Choose an actual ID from the catalogue. Check the model, verification evidence, price and licence:

```bash
ainize patch get <id>
ainize chat <id> "your question"
ainize use <id>
ainize patch stack
```

Live testing requires the node to hold the file. `use` buys, downloads and applies it;
review its quote before confirming. A failed apply may follow a successful purchase.
Check `ainize wallet` and `ainize purchases` before retrying.

## Stop

```bash
ainize stop
```

The home directory retains the node's key and data.
Next: [Teach from a file](../tutorials/teach-from-a-file.md) or
[buy and apply](../tutorials/buy-and-apply.md).
