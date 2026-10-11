# Connect nodes to your AIN account

Sign in at [Ainize](/signing) with your AIN account (SSO) or a compatible wallet. In your personal AinCode workspace, the existing AIN session connects the node to your account automatically.

## Connect a node

Use the latest CLI source while the new login flow is awaiting an npm release:

```bash
git clone https://github.com/ainblockchain/ainize-cli.git
cd ainize-cli
npm ci
npm install -g .
ainize init --home ~/.ainize-a --name node-a --port 3402
ainize login --home ~/.ainize-a
ainize start --home ~/.ainize-a -d
```

In personal AinCode, run `login --no-open`: the workspace uses your existing AIN session, so no separate Drive or wallet approval is needed. Outside AinCode, `login` opens the website; sign in and approve the node there. On SSH or a machine without a browser, open the printed link yourself. `--no-open` prevents opening a browser.

The node appears in [My nodes](/my-nodes). A running CLI node reports its status every minute. Linking lets it report status; it does not authorize wallet spending or account operations.

## Connect another node

Use a different home and port with the same account:

```bash
ainize init --home ~/.ainize-b --name node-b --port 3403
ainize login --home ~/.ainize-b
ainize start --home ~/.ainize-b -d
```

Disconnect individual nodes from My nodes. This removes the account link; it does not stop the process. Use `ainize stop --home ~/.ainize-b` to stop it.

## Local administration

For operator commands on your own node, use `ainize login --node-key --home ~/.ainize-a`. This keeps local administration separate from the website link. `--device` retains the explicit CLI account-delegation flow; its approval explains the permissions it grants.
