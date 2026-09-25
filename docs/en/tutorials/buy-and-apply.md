# Use knowledge someone else published

You need a running node, an operator session (`ainize login --node-key`) and a compatible runtime
for applying knowledge. Check the [quickstart](../get-started/quickstart.md).

## Find and inspect

```bash
ainize patch ls --status VERIFIED --q office
ainize patch get <id>
ainize patch records <id>
```

Use an ID returned by your node. Check the model identity, licence, parent dependencies,
price and attestations. Integrity-only verification does not measure answer quality.

## Try it

```bash
ainize chat --list
ainize chat <id> "your question"
```

The node must hold the file and have a working patch hook. Browser live tests are free,
subject to the node's quota; they do not purchase the knowledge.

## Buy and load

```bash
ainize use <id>
ainize wallet
ainize patch stack
```

Review the quote and confirm. Only eligible, verified knowledge can be bought.
The command includes missing parent knowledge in the quote when required.
To acquire the file without changing the running model:

```bash
ainize use <id> --no-apply
```

## Recover a partial failure

Payment, download and application are separate stages. An error in a later stage does not undo a purchase.

```bash
ainize purchases
ainize logs --kind buy
ainize patch download <id>
ainize patch apply <id>
```

`download` recovers an existing purchase; do not send another payment manually.
See [load several](../how-to/load-several.md) for parent ordering and removal,
and [verification](../concepts/verification.md) for what the status proves.
