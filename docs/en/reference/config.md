# Configuration reference

## How to read this page

Settings live in `config.json` under `--home` / `AINIZE_HOME` (default `~/.ainize`).

```bash
ainize config show
ainize config get runtime.api
ainize config set runtime.api http://localhost:8000
```

Restart the node after changing settings. Use `ainize config --help` for commands and the installed version's validation errors for accepted values. Amounts are decimal strings, such as `"0.1"`.

## Keys

| Group | Main settings |
|---|---|
| Node | `name`, `host`, `port`, `publicUrl`, `roles`, `peers` |
| Identity | `identity`, `operatorAddresses` |
| Ledger | `ledger.kind` (`local` or `ain`), `ledger.ain.providerUrl`, `ledger.ain.chainId`, `ledger.ain.appName` |
| Runtime | `runtime.repo`, `runtime.api`, `runtime.patchDir`, `runtime.gpus` |
| Verification | `verifier.quorum`, `verifier.auto`, `verifier.allowSelfAttest`, `verifier.minBalance` |
| Peer network | `p2p.acceptExchange`, `p2p.maxPeers`, `p2p.relayBlobs`, `p2p.maxRelayBytes` |
| Teaching | `teach.enabled`, `teach.backend`, `teach.trainer.gpus`, `teach.trainer.maxSteps` |
| Storage | `dataDir`, `events.retentionDays` |

Use distinct serving and training GPUs. `runtime.patchDir` must point to the mailbox mounted into the serving model. A stub trainer is for tests and does not train a model.

Model API backends and optional deposits require the matching node version; see [calling a model](../how-to/call-the-model.md).

## Protected keys

`identity` and its key fields cannot be changed with ordinary config commands. Back up the node home securely; `config.json` contains its private key.

## Environment variables

These are read at start-up and overwrite what is in `config.json` for that run; the file is not changed.

| Variable | Sets | Accepted values |
|---|---|---|
| `AINIZE_HOME` | the directory holding `config.json`, the node key and the data directory |   |
| `AINIZE_PORT` | `port` |   |
| `AINIZE_HOST` | `host` |   |
| `AINIZE_PEERS` | `peers` |   |
| `AINIZE_LEDGER` | `ledger.kind` | `"ain"`, `"local"` |
| `AIN_PROVIDER_URL` | `ledger.ain.providerUrl` |   |
| `AINIZE_ROLES` | `roles` |   |
| `AINIZE_PUBLIC_URL` | `publicUrl` |   |
| `AINIZE_RUNTIME_REPO` | `runtime.repo` |   |
| `AINIZE_RUNTIME_API` | `runtime.api` |   |
| `AINIZE_RUNTIME_PATCH_DIR` | `runtime.patchDir` |   |
| `AINIZE_TEACH_BACKEND` | `teach.backend` | `"stub"`, `"gradient"` |
| `AINIZE_TEACH_ENABLED` | `teach.enabled` | `"1"`, `"0"` |
| `AINIZE_TRUST_PROXY` | `server.trustProxy` |   |
| `AINIZE_TEACH_STUB_OFFLINE` | `teach.stubOffline` | `"1"`, `"0"` |

## The default `config.json`

Defaults depend on the installed version. Run `ainize init` in a new, dedicated home and inspect it with `ainize config show` rather than copying an old example containing someone else's identity.
