# Join the network from your own node

## Start and connect

Install Node 24+ and use a new home directory:

```bash
npm install -g ainize
export AINIZE_HOME="$HOME/ainize-joiner"
ainize init --name joiner --port 3455 --peer https://ainize.ai --roles seller
ainize start -d
ainize status
ainize login
ainize nodes
```

The default local ledger uses CREDIT. It does not share balances with AIN mainnet.
Check ledger compatibility before connecting other peers.

## Connect your runtime

Follow the model and patch-hook setup in [Quickstart](../get-started/quickstart.md).
Configure `runtime.gpus` with the host GPU indices actually used by the model container.
Add the `serving` role only when it is ready.

```bash
ainize patch ls --status VERIFIED
ainize use <id>
ainize chat <id> "your question"
```

Replace `<id>` with compatible knowledge from your node's catalogue and review the purchase quote.

## Enable teaching

A real trainer must be installed separately. Set its container, script and dedicated GPUs;
the CLI does not install a model or provision GPU hardware.

```bash
ainize config set teach.enabled true
ainize config set teach.backend gradient
ainize config set runtime.gpus <serving-gpu-indices>
ainize config set teach.trainer.gpus <separate-training-gpu-indices>
ainize stop
ainize start -d
ainize teach status
```

The two GPU sets must not overlap. Ensure `runtime.patchDir` belongs to the same serving instance as
`runtime.api`. Choose a training timeout appropriate for your model and dataset; an old experiment's timing
is not a capacity guarantee.

Then follow [Teach from a file](../tutorials/teach-from-a-file.md).

## Publish a reachable address

See [reachable nodes](./reachable-node.md) for TLS and proxy setup. Private nodes can use
supported P2P relay features, but must have a reachable peer willing to relay their files.
Keep originals and identity backups; a relay is not a backup service.

## Roles

| Role | Requirement |
|---|---|
| seller | Reachable API and retained knowledge files. |
| serving | Compatible model, patch hook and enough compute. |
| verifier | Storage, bandwidth and compatible runtime for executed checks. |

See [verifier costs](./run-a-verifier.md) before enabling background verification.
