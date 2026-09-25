---
title: CLI reference
summary: Command index and usage; use --help for version-specific options
---

# CLI reference



Use `ainize <command> --help` for the exact options of your installed version.

## How to read this page

Each command shows the shape of the line first: required arguments in `<angle brackets>`, optional ones in `[square brackets]`, a trailing `…` where several values may follow, and every required option spelled out. `[options]` stands for the options listed by `--help`.

An option with a type takes a value (`--limit 20`); a `boolean` option is a flag, and `--no-` in front of its name turns it off — `ainize init --no-force`.

The global options come first because they work everywhere; everything after that is one command per heading, nested exactly as its subcommands are.

## Global options

These are accepted by every command.

- **`--home`** (`string`) — node home directory (AINIZE_HOME)
- **`--node`** (`string`) — node API URL (default: http://localhost:\<config port>)
- **`--json`** (`boolean`, default `false`) — machine-readable JSON output — one document per command, errors included, on failure to stderr
- **`--quiet`** (`boolean`, default `false`) — print nothing but the id of whatever was created or changed
- **`--wide`** (`boolean`, default `false`) — do not fit tables to the terminal width (piped output is never fitted)
- **`--help`, `-h`** (`boolean`) — print the help for a command and exit
- **`--version`** (`boolean`) — print the CLI version and exit

## Commands

| Command | What it does |
|---|---|
| [`ainize init`](#ainize-init) | Create a node identity and config in AINIZE_HOME |
| [`ainize config`](#ainize-config) | Show or edit the node config |
| [`ainize keys`](#ainize-keys) | Node identity: the key that owns everything this node published |
| [`ainize start`](#ainize-start) | Start the node (foreground unless --detach) |
| [`ainize stop`](#ainize-stop) | Stop a background node |
| [`ainize status`](#ainize-status) | Show node / ledger / runtime status |
| [`ainize logs`](#ainize-logs) | Show node events |
| [`ainize seed`](#ainize-seed) | Seed demo data (prototype ledger, real Qwen3.8 patches if present, synthetic branches) |
| [`ainize nodes`](#ainize-nodes) | List the peers this node talks to and the nodes it knows of |
| [`ainize blobs`](#ainize-blobs) | Knowledge files this node holds on disk, and what they cost |
| [`ainize gc`](#ainize-gc) | Delete knowledge files this node neither published nor bought (verification copies) |
| [`ainize login`](#ainize-login) | Sign in — on the node's own machine with its key, anywhere else by approving this machine in a browser |
| [`ainize whoami`](#ainize-whoami) | Which address this session acts as, and which key is doing the acting |
| [`ainize bindings`](#ainize-bindings) | Machines you have authorised to act as you on this node |
| [`ainize operators`](#ainize-operators) | Who owns this node (its own key, always, plus operatorAddresses) |
| [`ainize logout`](#ainize-logout) | End this session |
| [`ainize peers`](#ainize-peers) | Manage peers |
| [`ainize agent`](#ainize-agent) | A2A agents this node serves: register one, see whether it answers, and call it |
| [`ainize patch`](#ainize-patch) | Publish, inspect, verify, buy and apply knowledge patches — or give an ENS name to use one in a single line |
| [`ainize publish`](#ainize-publish) | One line to sell knowledge: register a .npz + benchmark and announce it at once — the network verifies, you get paid per sale (`ainize patch publish` is the same operation, stopping at a draft) |
| [`ainize teach`](#ainize-teach) | Teach mode: turn your own questions and answers into knowledge. Two doors, one pipeline — a dataset file here, or corrections collected in the browser (\<node>/chat?teach=1) |
| [`ainize dataset`](#ainize-dataset) | Import a Hugging Face dataset, or inspect the training set of published knowledge |
| [`ainize use`](#ainize-use) | One line to use knowledge: check it is verified → quote the price → pay → download → load into your model. Several ids are used in the order given |
| [`ainize chat`](#ainize-chat) | Live-test a knowledge patch: the model's answer before vs after the patch is loaded (correct-answer check) |
| [`ainize ledger`](#ainize-ledger) | Inspect the ledger |
| [`ainize branch`](#ainize-branch) | Knowledge branches (parallel, possibly contradictory patch sets) |
| [`ainize route`](#ainize-route) | Gateway routing: which track and which nodes serve a request context |
| [`ainize wallet`](#ainize-wallet) | Balance, sales, royalties and pending payouts of this node |
| [`ainize purchases`](#ainize-purchases) | Knowledge this node bought: what, from whom, for how much, and whether it is loaded |
| [`ainize payouts`](#ainize-payouts) | Royalty transfers this node owes creators and data providers (AIN ledger) |
| [`ainize drive`](#ainize-drive) | aindrive: files & change history of this node |
| [`ainize chain`](#ainize-chain) | Local AIN blockchain (docker) for the ain ledger |

## `ainize init`

```bash
ainize init [options]
```

Create a node identity and config in AINIZE_HOME


## `ainize config`

```bash
ainize config <subcommand>
```

Show or edit the node config

**Subcommands** — one of them is required

- `ainize config show` — Print config.json (secrets hidden)
- `ainize config get` — Print one config key (dotted path)
- `ainize config set` — Set a config key (dotted path, e.g. market.defaultPrice 0.5)
- `ainize config unset` — Remove a config key so the node uses its built-in default

### `ainize config show`

```bash
ainize config show
```

Print config.json (secrets hidden)

### `ainize config get`

```bash
ainize config get <key>
```

Print one config key (dotted path)

**Arguments**

- **`<key>`** (`string`, required)

**Examples**

```bash
ainize config get market.defaultPrice
```

### `ainize config set`

```bash
ainize config set <key> <value>
```

Set a config key (dotted path, e.g. market.defaultPrice 0.5)

**Arguments**

- **`<key>`** (`string`, required)
- **`<value>`** (`string`, required)

**Examples**

```bash
ainize config set ledger.kind ain
ainize config set peers http://a:3402,http://b:3403
```

### `ainize config unset`

```bash
ainize config unset <key>
```

Remove a config key so the node uses its built-in default

**Arguments**

- **`<key>`** (`string`, required)

**Examples**

```bash
ainize config unset teach.trainer.gpus
```

## `ainize keys`

```bash
ainize keys <subcommand>
```

Node identity: the key that owns everything this node published

**Subcommands** — one of them is required

- `ainize keys show` — Print address and public key
- `ainize keys backup` — Save the node key to a file (encrypted with --passphrase) — the only way back after a wiped disk
- `ainize keys import` — Make a backed-up key this node's identity (asks you to type the current address)
- `ainize keys rotate` — Mint a NEW node identity, keeping every other setting (asks you to type the current address)

### `ainize keys show`

```bash
ainize keys show [options]
```

Print address and public key


### `ainize keys backup`

```bash
ainize keys backup <file> [options]
```

Save the node key to a file (encrypted with --passphrase) — the only way back after a wiped disk

Also spelled `ainize keys export`.

**Arguments**

- **`<file>`** (`string`, required)


### `ainize keys import`

```bash
ainize keys import <file> [options]
```

Make a backed-up key this node's identity (asks you to type the current address)

**Arguments**

- **`<file>`** (`string`, required)


### `ainize keys rotate`

```bash
ainize keys rotate
```

Mint a NEW node identity, keeping every other setting (asks you to type the current address)

## `ainize start`

```bash
ainize start [options]
```

Start the node (foreground unless --detach)


## `ainize stop`

```bash
ainize stop
```

Stop a background node

## `ainize status`

```bash
ainize status [options]
```

Show node / ledger / runtime status


## `ainize logs`

```bash
ainize logs [options]
```

Show node events


## `ainize seed`

```bash
ainize seed [options]
```

Seed demo data (prototype ledger, real Qwen3.8 patches if present, synthetic branches)


## `ainize nodes`

```bash
ainize nodes [options]
```

List the peers this node talks to and the nodes it knows of


## `ainize blobs`

```bash
ainize blobs <subcommand>
```

Knowledge files this node holds on disk, and what they cost

**Subcommands** — one of them is required

- `ainize blobs ls` — List every knowledge file with its size and why it is held

### `ainize blobs ls`

```bash
ainize blobs ls
```

List every knowledge file with its size and why it is held

Also spelled `ainize blobs list`.

## `ainize gc`

```bash
ainize gc [options]
```

Delete knowledge files this node neither published nor bought (verification copies)


## `ainize login`

```bash
ainize login [options]
```

Sign in — on the node's own machine with its key, anywhere else by approving this machine in a browser


## `ainize whoami`

```bash
ainize whoami
```

Which address this session acts as, and which key is doing the acting

**Examples**

```bash
# and whether that address owns this node
ainize whoami
```

## `ainize bindings`

```bash
ainize bindings [options]
```

Machines you have authorised to act as you on this node


## `ainize operators`

```bash
ainize operators [options]
```

Who owns this node (its own key, always, plus operatorAddresses)


## `ainize logout`

```bash
ainize logout [options]
```

End this session


## `ainize peers`

```bash
ainize peers <subcommand>
```

Manage peers

**Subcommands** — one of them is required

- `ainize peers ls` — List peers
- `ainize peers add` — Add a peer
- `ainize peers rm` — Remove a peer

### `ainize peers ls`

```bash
ainize peers ls
```

List peers

### `ainize peers add`

```bash
ainize peers add <url>
```

Add a peer

**Arguments**

- **`<url>`** (`string`, required)

### `ainize peers rm`

```bash
ainize peers rm <url>
```

Remove a peer

**Arguments**

- **`<url>`** (`string`, required)

## `ainize agent`

```bash
ainize agent <subcommand>
```

A2A agents this node serves: register one, see whether it answers, and call it

**Subcommands** — one of them is required

- `ainize agent ls` — List agents, their skills and whether they are answering
- `ainize agent add` — Register an agent process at a public address on this node
- `ainize agent rm` — Unregister an agent (its public address stops resolving)
- `ainize agent on` — Publish a registered agent
- `ainize agent off` — Keep the registration but take the public address down
- `ainize agent card` — The agent card as this node serves it to a workspace
- `ainize agent call` — Send a message the way a workspace would, through the public path

### `ainize agent ls`

```bash
ainize agent ls
```

List agents, their skills and whether they are answering

### `ainize agent add`

```bash
ainize agent add <id> [options]
```

Register an agent process at a public address on this node

**Arguments**

- **`<id>`** (`string`, required) — URL segment: /agents/\<id>


### `ainize agent rm`

```bash
ainize agent rm <id> [options]
```

Unregister an agent (its public address stops resolving)

**Arguments**

- **`<id>`** (`string`, required)


### `ainize agent on`

```bash
ainize agent on <id>
```

Publish a registered agent

**Arguments**

- **`<id>`** (`string`, required)

### `ainize agent off`

```bash
ainize agent off <id>
```

Keep the registration but take the public address down

**Arguments**

- **`<id>`** (`string`, required)

### `ainize agent card`

```bash
ainize agent card <id>
```

The agent card as this node serves it to a workspace

**Arguments**

- **`<id>`** (`string`, required)

### `ainize agent call`

```bash
ainize agent call <id> <prompt…>
```

Send a message the way a workspace would, through the public path

**Arguments**

- **`<id>`** (`string`, required)
- **`<prompt…>`** (`string[]`, required)

**Examples**

```bash
# one JSON-RPC message/send, as a stranger would
ainize agent call donga-desk "오늘 파이프라인 상태 알려줘"
```

## `ainize patch`

```bash
ainize patch [name] [options] <subcommand>
```

Publish, inspect, verify, buy and apply knowledge patches — or give an ENS name to use one in a single line

`ainize patch [name]` runs without naming a subcommand.

**Arguments**

- **`[name]`** (`string`) — an ENS name, e.g. vaults.defi.engram.eth


### `ainize patch ls`

```bash
ainize patch ls [options]
```

List patches in the catalog


### `ainize patch get`

```bash
ainize patch get <id>
```

Show a patch in detail

**Arguments**

- **`<id>`** (`string`, required)

### `ainize patch publish`

```bash
ainize patch publish <file> --name <value> --model <value> --benchmark <value> [options]
```

Register a .npz patch body as a draft — it stays a DRAFT until --announce (`ainize publish` is the same operation, announcing at once)

**Arguments**

- **`<file>`** (`string`, required) — path to the learned knowledge (.npz: addrs/before/after) on the node machine


### `ainize patch import`

```bash
ainize patch import <file> --recipe <value> [options]
```

Import a downloaded lesson (.npz + recipe.json) as a PRIVATE draft: no announce, no ledger record

**Arguments**

- **`<file>`** (`string`, required) — lesson-\<slug>.npz on the node machine (stays in place)


### `ainize patch announce`

```bash
ainize patch announce <id> [options]
```

DRAFT → ANNOUNCED (anchor on the ledger)

**Arguments**

- **`<id>`** (`string`, required)


### `ainize patch retire`

```bash
ainize patch retire <id> [options]
```

Take your published knowledge off sale for good (the record stays; buyers keep their copy)

**Arguments**

- **`<id>`** (`string`, required)


### `ainize patch verify`

```bash
ainize patch verify <id> [options]
```

Run this node's verifier on a patch and publish an attestation

**Arguments**

- **`<id>`** (`string`, required)


### `ainize patch challenge`

```bash
ainize patch challenge <id> --reason <value>
```

Dispute a verification: takes the knowledge off sale until a verifier re-runs it

**Arguments**

- **`<id>`** (`string`, required)


### `ainize patch buy`

```bash
ainize patch buy <ids…> [options]
```

Buy listed knowledge via HTTP 402 (x402) and download the body — several ids buy them in the order given

**Arguments**

- **`<ids…>`** (`string[]`, required) — knowledge id(s) — `a b` or `a,b`, bought in the order given


### `ainize patch price`

```bash
ainize patch price <id> <price> [options]
```

Change what a published knowledge sells for (0 makes it free)

**Arguments**

- **`<id>`** (`string`, required) — the knowledge to re-price (you must be its author)
- **`<price>`** (`string`, required) — the new price in this node's currency, e.g. 2.5 — "0" makes it free


### `ainize patch download`

```bash
ainize patch download <id>
```

Collect a knowledge this node already paid for — no second payment

**Arguments**

- **`<id>`** (`string`, required)

**Examples**

```bash
# after a lost manifest, a forgotten body or a purchase that died mid-payment
ainize patch download krx-all-2761
```

### `ainize patch apply`

```bash
ainize patch apply <ids…> [options]
```

Load held knowledge into the serving model (no restart) — several ids load in the order given, the last winning on any entry they share

**Arguments**

- **`<ids…>`** (`string[]`, required) — knowledge id(s) — `a b` or `a,b`, loaded in the order given


### `ainize patch remove`

```bash
ainize patch remove <ids…> [options]
```

Unload knowledge from the serving model, putting back whatever was underneath

**Arguments**

- **`<ids…>`** (`string[]`, required) — knowledge id(s) — `a b` or `a,b`


### `ainize patch stack`

```bash
ainize patch stack
```

What is loaded in the serving model, bottom first

### `ainize patch fork`

```bash
ainize patch fork <id> [options]
```

Copy this knowledge's questions into your own training set, and continue from there

**Arguments**

- **`<id>`** (`string`, required)


### `ainize patch merge`

```bash
ainize patch merge <a> <b> [options]
```

Combine two knowledges into one: what overlaps, what they answer differently, and how to build it

**Arguments**

- **`<a>`** (`string`, required) — the first knowledge
- **`<b>`** (`string`, required) — the second one — where they disagree, this one is the alternative answer


### `ainize patch tree`

```bash
ainize patch tree <id> [options]
```

The family tree: what this was built on, what was built on it, and what each one added

**Arguments**

- **`<id>`** (`string`, required)


### `ainize patch missing`

```bash
ainize patch missing <id> [options]
```

Open questions: what people asked this knowledge that it could not answer

**Arguments**

- **`<id>`** (`string`, required)


### `ainize patch signals`

```bash
ainize patch signals <id>
```

How a knowledge is doing: network facts, and this node's last 30 days

**Arguments**

- **`<id>`** (`string`, required)

### `ainize patch conflicts`

```bash
ainize patch conflicts <id>
```

Address-set overlaps with other patches

**Arguments**

- **`<id>`** (`string`, required)

### `ainize patch records`

```bash
ainize patch records <id>
```

Ledger records about a patch

**Arguments**

- **`<id>`** (`string`, required)

### `ainize patch rm`

```bash
ainize patch rm <id> [options]
```

Delete a draft (says what goes, and asks first)

**Arguments**

- **`<id>`** (`string`, required) — draft id (`ainize patch ls --drafts`)


### `ainize patch forget`

```bash
ainize patch forget <id> [options]
```

Delete this node's copy of the knowledge file. NOT a takedown: it stays listed and the gateway keeps charging — use `patch retire` for that

**Arguments**

- **`<id>`** (`string`, required)


## `ainize publish`

```bash
ainize publish <file> --name <value> --model <value> --benchmark <value> [options]
```

One line to sell knowledge: register a .npz + benchmark and announce it at once — the network verifies, you get paid per sale (`ainize patch publish` is the same operation, stopping at a draft)

**Arguments**

- **`<file>`** (`string`, required) — path to the learned knowledge (.npz: addrs/before/after)


## `ainize teach`

```bash
ainize teach <target> [options] <subcommand>
```

Teach mode: turn your own questions and answers into knowledge. Two doors, one pipeline — a dataset file here, or corrections collected in the browser (\<node>/chat?teach=1)

`ainize teach <target>` runs without naming a subcommand.

**Arguments**

- **`<target>`** (`string`, required) — dataset id (`ainize teach dataset ls`) or a dataset file, which is uploaded first


### `ainize teach status`

```bash
ainize teach status [target] [options]
```

Teaching policy of a node, the status of a lesson, or a data provider's lessons and earnings

**Arguments**

- **`[target]`** (`string`) — node URL · lesson URL (…/chat?lesson=\<id>) or job id · teacher page (…/teacher/\<address>) or 0x address; default: this node


### `ainize teach dataset`

```bash
ainize teach dataset <subcommand>
```

The questions a lesson is trained from: upload a file, list, inspect, download, delete

**Subcommands** — one of them is required

- `ainize teach dataset upload` — Validate a dataset file and upload it (nothing is trained until you say so)
- `ainize teach dataset ls` — My datasets on this node
- `ainize teach dataset get` — One dataset: every source line with the reason it was or was not used; -o writes the questions to a file
- `ainize teach dataset rm` — Delete a dataset (the lessons trained from it are kept)

#### `ainize teach dataset upload`

```bash
ainize teach dataset upload <file> [options]
```

Validate a dataset file and upload it (nothing is trained until you say so)

This is the default subcommand: `ainize teach dataset <file>` runs it without naming `upload`.

**Arguments**

- **`<file>`** (`string`, required) — .jsonl · .json · .csv · .tsv · .txt with one question and its answer per row


#### `ainize teach dataset ls`

```bash
ainize teach dataset ls [options]
```

My datasets on this node


#### `ainize teach dataset get`

```bash
ainize teach dataset get <id> [options]
```

One dataset: every source line with the reason it was or was not used; -o writes the questions to a file

Also spelled `ainize teach dataset download`.

**Arguments**

- **`<id>`** (`string`, required)


#### `ainize teach dataset rm`

```bash
ainize teach dataset rm <id> [options]
```

Delete a dataset (the lessons trained from it are kept)

**Arguments**

- **`<id>`** (`string`, required)


### `ainize teach jobs`

```bash
ainize teach jobs [options]
```

My lessons on this node and the dataset each came from


### `ainize teach recheck`

```bash
ainize teach recheck <job-id> [options]
```

Measure a lesson that was saved unchecked (the model server was unavailable)

**Arguments**

- **`<job-id>`** (`string`, required) — lesson id (`ainize teach jobs`)


### `ainize teach publish`

```bash
ainize teach publish <job-id> --name <value> [options]
```

Publish a READY lesson as knowledge (the last step of `teach <file>` — needs both consent flags)

**Arguments**

- **`<job-id>`** (`string`, required) — lesson id (`ainize teach jobs`)


## `ainize dataset`

```bash
ainize dataset <subcommand>
```

Import a Hugging Face dataset, or inspect the training set of published knowledge

**Subcommands** — one of them is required

- `ainize dataset import` — Import an existing Hugging Face dataset into this node (no Hub publication)
- `ainize dataset get` — The training set of a knowledge — what it is, and with -o the questions themselves

### `ainize dataset import`

```bash
ainize dataset import <url> [options]
```

Import an existing Hugging Face dataset into this node (no Hub publication)

This is the default subcommand: `ainize dataset <url>` runs it without naming `import`.

**Arguments**

- **`<url>`** (`string`, required) — https://huggingface.co/datasets/\<owner>/\<name> or a /resolve/\<revision>/\<file> URL


### `ainize dataset get`

```bash
ainize dataset get <id> [options]
```

The training set of a knowledge — what it is, and with -o the questions themselves

Also spelled `ainize dataset download`.

**Arguments**

- **`<id>`** (`string`, required) — knowledge id (`ainize patch ls`) or the sha256 of the training set


## `ainize use`

```bash
ainize use <ids…> [options]
```

One line to use knowledge: check it is verified → quote the price → pay → download → load into your model. Several ids are used in the order given

**Arguments**

- **`<ids…>`** (`string[]`, required) — knowledge id(s) — `a b` or `a,b`, in load order (see `ainize patch ls`)


## `ainize chat`

```bash
ainize chat [patchId] [prompt…] [options]
```

Live-test a knowledge patch: the model's answer before vs after the patch is loaded (correct-answer check)

**Arguments**

- **`[patchId]`** (`string`) — patch to test, or https://huggingface.co/\<owner>/\<model> for the exact model already served by this node
- **`[prompt…]`** (`string[]`) — question; omit for an interactive session (/quit to exit)


## `ainize ledger`

```bash
ainize ledger <subcommand>
```

Inspect the ledger

**Subcommands** — one of them is required

- `ainize ledger inference` — Inspect native inference batch submissions (operator only)
- `ainize ledger ls` — List records
- `ainize ledger verify` — Verify hashes, signatures and chain linkage
- `ainize ledger graph` — ASCII lineage tree
- `ainize ledger export` — Export records as JSON lines

### `ainize ledger inference`

```bash
ainize ledger inference [id] [options]
```

Inspect native inference batch submissions (operator only)

**Arguments**

- **`[id]`** (`string`) — local batch ID; omit to list newest batches


### `ainize ledger ls`

```bash
ainize ledger ls [options]
```

List records


### `ainize ledger verify`

```bash
ainize ledger verify
```

Verify hashes, signatures and chain linkage

### `ainize ledger graph`

```bash
ainize ledger graph
```

ASCII lineage tree

### `ainize ledger export`

```bash
ainize ledger export <file>
```

Export records as JSON lines

**Arguments**

- **`<file>`** (`string`, required)

## `ainize branch`

```bash
ainize branch <subcommand>
```

Knowledge branches (parallel, possibly contradictory patch sets)

**Subcommands** — one of them is required

- `ainize branch ls` — List branches
- `ainize branch create` — Create a branch
- `ainize branch archive` — Take a track of yours off /network, the router and `branch ls` (the record and its subscribers stay)
- `ainize branch unarchive` — Put an archived track back on the lists
- `ainize branch terms` — What following your track costs, per period (the curation fee)
- `ainize branch add` — Add knowledge to a track you own (verified knowledge only)
- `ainize branch quote` — What subscribing to this track would spend, item by item, before anything is spent
- `ainize branch subscribe` — Subscribe this node: buy the track's current knowledge, load it, and keep it up to date
- `ainize branch sync` — Bring a subscribed track up to date now (buy and load what it added, unload what it retired)
- `ainize branch unsubscribe` — Unsubscribe (unload the track's knowledge; nothing is refunded)
- `ainize branch rm` — Take a knowledge off a track you own (subscribers stop buying and loading it)

### `ainize branch ls`

```bash
ainize branch ls [options]
```

List branches


### `ainize branch create`

```bash
ainize branch create <name> [options]
```

Create a branch

**Arguments**

- **`<name>`** (`string`, required)


### `ainize branch archive`

```bash
ainize branch archive <name>
```

Take a track of yours off /network, the router and `branch ls` (the record and its subscribers stay)

**Arguments**

- **`<name>`** (`string`, required)

**Examples**

```bash
# a fixture track written by a test run comes off the shelf
ainize branch archive e2e/KR-1788174110
```

### `ainize branch unarchive`

```bash
ainize branch unarchive <name>
```

Put an archived track back on the lists

**Arguments**

- **`<name>`** (`string`, required)

### `ainize branch terms`

```bash
ainize branch terms <name> [options]
```

What following your track costs, per period (the curation fee)

**Arguments**

- **`<name>`** (`string`, required) — a track you own


### `ainize branch add`

```bash
ainize branch add <name> <patchId> [options]
```

Add knowledge to a track you own (verified knowledge only)

**Arguments**

- **`<name>`** (`string`, required) — the track (see `ainize branch ls`)
- **`<patchId>`** (`string`, required) — the knowledge to add — every subscriber buys and loads it


### `ainize branch quote`

```bash
ainize branch quote <name>
```

What subscribing to this track would spend, item by item, before anything is spent

**Arguments**

- **`<name>`** (`string`, required)

### `ainize branch subscribe`

```bash
ainize branch subscribe <name> [options]
```

Subscribe this node: buy the track's current knowledge, load it, and keep it up to date

**Arguments**

- **`<name>`** (`string`, required)


### `ainize branch sync`

```bash
ainize branch sync <name>
```

Bring a subscribed track up to date now (buy and load what it added, unload what it retired)

**Arguments**

- **`<name>`** (`string`, required)

### `ainize branch unsubscribe`

```bash
ainize branch unsubscribe <name>
```

Unsubscribe (unload the track's knowledge; nothing is refunded)

**Arguments**

- **`<name>`** (`string`, required)

### `ainize branch rm`

```bash
ainize branch rm <name> <patchId> [options]
```

Take a knowledge off a track you own (subscribers stop buying and loading it)

**Arguments**

- **`<name>`** (`string`, required) — track name
- **`<patchId>`** (`string`, required) — the knowledge to remove from it


## `ainize route`

```bash
ainize route <context…> [options]
```

Gateway routing: which track and which nodes serve a request context

**Arguments**

- **`<context…>`** (`string[]`, required) — k=v pairs


## `ainize wallet`

```bash
ainize wallet <subcommand>
```

Balance, sales, royalties and pending payouts of this node

**Subcommands**

- `ainize wallet show` — Balance, sales, royalties and pending payouts
- `ainize wallet send` — Send AIN from this node's wallet to another address

### `ainize wallet show`

```bash
ainize wallet show
```

Balance, sales, royalties and pending payouts

This is the default subcommand: `ainize wallet` runs it without naming `show`.

### `ainize wallet send`

```bash
ainize wallet send <address> <amount> [options]
```

Send AIN from this node's wallet to another address

**Arguments**

- **`<address>`** (`string`, required) — where the money goes (0x… AIN address)
- **`<amount>`** (`number`, required) — how much, in AIN


## `ainize purchases`

```bash
ainize purchases
```

Knowledge this node bought: what, from whom, for how much, and whether it is loaded

**Examples**

```bash
# every purchase with its seller, tx and file
ainize purchases
```

## `ainize payouts`

```bash
ainize payouts <subcommand>
```

Royalty transfers this node owes creators and data providers (AIN ledger)

**Subcommands**

- `ainize payouts ls` — List payouts
- `ainize payouts retry` — Retry one failed / pending payout now
- `ainize payouts reconcile` — Rebuild the payouts this node owes from its own settlements, then pay what is due

### `ainize payouts ls`

```bash
ainize payouts ls [options]
```

List payouts

This is the default subcommand: `ainize payouts` runs it without naming `ls`.


### `ainize payouts retry`

```bash
ainize payouts retry <id>
```

Retry one failed / pending payout now

**Arguments**

- **`<id>`** (`number`, required) — the payout row id (`ainize payouts ls`)

### `ainize payouts reconcile`

```bash
ainize payouts reconcile
```

Rebuild the payouts this node owes from its own settlements, then pay what is due

**Examples**

```bash
# after a restore, a crash, or an upgrade
ainize payouts reconcile
```

## `ainize drive`

```bash
ainize drive <subcommand>
```

aindrive: files & change history of this node

**Subcommands** — one of them is required

- `ainize drive status` — Drive status (pairing, agent, files)
- `ainize drive up` — Start the aindrive agent for the node's drive folder
- `ainize drive stop` — Stop the aindrive agent
- `ainize drive sync` — Rewrite the drive mirror from the current market state
- `ainize drive login` — One-time browser pairing of the drive folder (interactive)

### `ainize drive status`

```bash
ainize drive status [options]
```

Drive status (pairing, agent, files)


### `ainize drive up`

```bash
ainize drive up
```

Start the aindrive agent for the node's drive folder

### `ainize drive stop`

```bash
ainize drive stop
```

Stop the aindrive agent

### `ainize drive sync`

```bash
ainize drive sync
```

Rewrite the drive mirror from the current market state

### `ainize drive login`

```bash
ainize drive login [options]
```

One-time browser pairing of the drive folder (interactive)


## `ainize chain`

```bash
ainize chain <subcommand>
```

Local AIN blockchain (docker) for the ain ledger

**Subcommands** — one of them is required

- `ainize chain up` — Start (or attach to) a local 1-node AIN chain on :8081
- `ainize chain down` — Remove the local chain container
- `ainize chain status` — Chain health and last block
- `ainize chain fund` — Transfer AIN from the local genesis account (local chain only)
- `ainize chain setup` — Register the knowledge app + market rules on-chain (funds the node identity first on a local chain)

### `ainize chain up`

```bash
ainize chain up [options]
```

Start (or attach to) a local 1-node AIN chain on :8081


### `ainize chain down`

```bash
ainize chain down
```

Remove the local chain container

### `ainize chain status`

```bash
ainize chain status [options]
```

Chain health and last block


### `ainize chain fund`

```bash
ainize chain fund <address> [amount] [options]
```

Transfer AIN from the local genesis account (local chain only)

**Arguments**

- **`<address>`** (`string`, required) — the AIN address to credit (`ainize keys show`)
- **`[amount]`** (`number`, default `1000`) — how much AIN


### `ainize chain setup`

```bash
ainize chain setup [options]
```

Register the knowledge app + market rules on-chain (funds the node identity first on a local chain)
