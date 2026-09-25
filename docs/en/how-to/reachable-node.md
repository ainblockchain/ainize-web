# Run a node others can reach

## `host` binds. `publicUrl` is what peers write down

Bind the API to loopback behind a TLS reverse proxy. Set `publicUrl` to the HTTPS address peers can reach.
If binding to a LAN interface directly, restrict access with your firewall.

```bash
ainize config set publicUrl https://your-node.example.com
ainize stop
ainize start -d
```

The reverse proxy must forward `/api`, `/p2p`, `/x402` and `/agents`, preserve authentication headers
and allow streaming responses. The web UI is a separate Next.js application.

## Seed one peer; peer exchange does the rest

```bash
ainize peers add https://ainize.ai
ainize nodes
```

Peers must use compatible ledger settings. Learning an endpoint does not prove it is reachable.
Do not advertise `localhost` to another machine.

## Telling "not peered" from "peered and silent"

```bash
ainize status --check
ainize logs --kind p2p --limit 10
```

Check connection errors, last-seen times and ledger mismatches. Test your public API from another machine:

```bash
curl --fail https://your-node.example.com/api/info
```

## Roles

`seller` serves files, `serving` needs a model, and `verifier` may download and score other people's files.
Enable only the roles you can support; see [verifier costs](./run-a-verifier.md).

## Run it detached, and watch it

```bash
ainize start -d
ainize status --check --json
ainize stop
```

Use a process supervisor for boot-time startup and configure log retention.
Back up the home directory, including identity and ledger data.
