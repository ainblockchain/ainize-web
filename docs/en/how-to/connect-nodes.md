# Connect nodes to your wallet

Sign in at [Ainize](/signing) with any MetaMask or compatible wallet. No particular address is required.

## Connect a node

Use the latest CLI source while the new login flow is awaiting an npm release:

```bash
npm install -g github:ainblockchain/ainize-cli
ainize init --home ~/.ainize-a --name node-a --port 3402
ainize login --home ~/.ainize-a
ainize start --home ~/.ainize-a -d
```

`login` opens the website. If you are already signed in, approve the node with that wallet. Otherwise sign in first; you will return to the approval page. On SSH or a machine without a browser, open the printed link yourself. `--no-open` prints the link without opening it.

The node appears in [My nodes](/my-nodes). A running CLI node reports its status every minute. Linking lets it report status; it does not authorize wallet spending or account operations.

## Connect another node

Use a different home and port, then approve with the same wallet:

```bash
ainize init --home ~/.ainize-b --name node-b --port 3403
ainize login --home ~/.ainize-b
ainize start --home ~/.ainize-b -d
```

Disconnect individual nodes from My nodes. This removes the account link; it does not stop the process. Use `ainize stop --home ~/.ainize-b` to stop it.

## Local administration

For operator commands on your own node, use `ainize login --node-key --home ~/.ainize-a`. This keeps local administration separate from the website link. `--device` retains the explicit CLI account-delegation flow; its approval explains the permissions it grants.
