---
title: Run agents with Google AX
summary: Install Google Agent Executor alongside Ainize and create, inspect, suspend and resume sandboxed agent tasks.
---

# Run agents with Google AX

[Google AX](https://github.com/google/ax) runs agent tasks through Agent Substrate on Kubernetes.
**Execution hosts share one Kubernetes cluster under a trusted administrator.** Kubernetes and Agent Substrate
are required to provide AX execution, but not to join the Ainize peer network. Independent operators
can run their own Ainize-node and communicate through the existing peer protocol without joining
this cluster or receiving its credentials. One operator may use one logical Ainize-node service for
many workers; this does not replace independent peers throughout the network. AX schedules tasks
across its execution workers. This integration is separate from the `@ax-llm/ax` TypeScript library.
Organizations may also share that cluster while retaining independent peer identities
and permissions. Namespace, RBAC, network, storage, quota and sandbox isolation must
be verified together; the current staging manifests do not establish that isolation.

Ainize-node remains the peer-facing application: it keeps the peer identity and
state, authenticates users, communicates with other peers and exposes model and
project APIs. Kubernetes places and restarts its Pods. AX and Substrate provide
the agent execution environment. The operator AX API described here is connected;
automatic execution of existing Ainize project runs through AX is still pending.
Next.js hosting also requires a Kubernetes build/deployment backend before moving
existing Docker application hosts. The staged Pod alone does not provide it.
Audit ownership, balances, data and deployment references before consolidating
legacy peers belonging to the same operator. Preserve independent participants
and retain all identities and state until migration is verified.
Concurrent replicas of the surviving identity require redesigning the current
SQLite and in-process state.

Requests to another operator continue through authenticated Ainize peer interfaces
and that provider's admission rules. Peer discovery does not enroll hosts in
Kubernetes. The operator-only AX API below is not a public peer execution endpoint;
automatic AX project execution must be completed before advertising that capability.

## Prepare the shared cluster

First inventory the hosts, live peer identities, existing deployments and persistent data. Follow the
[shared cluster guide](https://github.com/ainblockchain/ainize-node/blob/main/deploy/cluster/README.md)
to generate one kubeadm initialization configuration and worker join configurations using the same
API endpoint and pinned cluster CA. The supported configuration uses Kubernetes v1.37.1 and enables
the certificate features required by Substrate. The plan generator checks existing network ranges,
duplicate identities and complete host membership. Generating a plan does not migrate live workloads.

Once all hosts are Ready, configure persistent storage, cluster networking with NetworkPolicy enforcement,
a registry accessible from every worker, and the Substrate operator installation document. Follow the
[AX installation guide](https://github.com/ainblockchain/ainize-node/blob/main/deploy/ax/README.md)
to set `KUBECONFIG`, `AINIZE_SUBSTRATE_CONFIG`, `AX_IMAGE_REPO`, `AX_SNAPSHOTS_BUCKET` and
`AINIZE_AX_STORAGE_CLASS`, then run from the ainize-node checkout:

```bash
bash deploy/ax/install.sh /secure/ainize-inventory.json
```

The installer checks the complete shared cluster inventory before installing Substrate v0.5.0 and AX
`0f085aa063db6de888e37def7a8943f7901e6c1e`. It creates the AX control plane, gVisor workers and persistent
Redis storage in the existing cluster. Snapshot storage must be reachable from every worker. It does
not create host-local clusters or migrate existing peer data automatically.

Ainize peer Pods in the `ainize-peers` namespace use the label `app.kubernetes.io/name: ainize-node`
and these environment settings:

```text
AINIZE_AX_ADDRESS=ax-server.ax-system.svc.cluster.local:8080
AINIZE_AX_ATESPACE=ainize
AINIZE_AX_ROUTER_ADDRESS=atenet-router.ate-system.svc.cluster.local:80
AINIZE_DEPLOYMENT_MANAGER=kubernetes
```

Keep the AX service private. Its control API does not apply Ainize user authentication; use the
Ainize operator API below. For temporary local diagnostics, an administrator can use
`kubectl -n ax-system port-forward --address 127.0.0.1 svc/ax-server 18080:8080` and point a local
Ainize node at `127.0.0.1:18080`.

## Stage existing peers in the cluster

The node package includes `deploy/cluster/peers.mjs` and `peers.example.json`.
Prepare a private schema-version-2 rollout file. In `peers`, list only the identities
to stage, each with its restored PVC, runtime UID/GID and resource limits. Use one
digest-pinned image. Account for all other inventoried identities in `deferredPeers`,
each with an `address` and a nonempty `reason` describing unresolved migration work.
The example selects one service. Deferral creates no Pod and neither stops the old
process nor merges its data; it does not establish migration completion.
The renderer supplies no AX connection by default. Configure the optional per-peer
`ax` object (`address`, `atespace`, optional `routerAddress`) only for trusted
control-plane peers. An atespace setting scopes client requests; it is not
server-side tenant authentication. Keep direct AX/Substrate access private.
Build the common image from a committed node checkout and test it locally:

```bash
bash deploy/cluster/build-peer.sh registry.example.com/ainize-node:release
PEER_TEST_IMAGE=registry.example.com/ainize-node:release node --test --import tsx test/peer-image.integration.test.ts
```

The builder uses committed inputs, locked dependencies and a pinned Node base.
It records the source commit in the image and provides the built package at
`/opt/ainize`. The test checks synthetic peer data in isolated containers; actual
model and project dependencies still need validation. Push the image to your
registry and use its registry manifest digest in the rollout file. Restore each peer
home at `/var/lib/ainize` and update the restored configuration's absolute data paths.
Use retained CSI filesystem volumes with `ReadWriteOncePod`, annotated with
`ainize.ai/peer-address`. Check live storage and render the stopped workloads:

```bash
umask 077
kubectl -n ainize-peers get pvc -o json > /secure/peer-pvcs.json
kubectl get pv -o json > /secure/peer-pvs.json
node deploy/cluster/peers.mjs verify-storage /secure/ainize-inventory.json /secure/peer-rollout.json /secure/peer-pvcs.json /secure/peer-pvs.json
node deploy/cluster/peers.mjs render /secure/ainize-inventory.json /secure/peer-rollout.json > /secure/peer-workloads.json
kubectl apply --dry-run=server -f /secure/peer-workloads.json
```

Use the verified shared-cluster context. Generated StatefulSets have zero replicas
and `OnDelete` updates: applying them stages the fleet without starting peers.
Stop each old writer and verify its backup restore before activating a canary.
Do not reapply the zero-replica staging file to running peers. Existing Docker
project execution, model servers and public traffic need separate migration
checks; these Pods do not mount a Docker socket or allocate GPUs.

Kubernetes management mode disables legacy `node.update` and host model deploy,
stop and pull commands, returning `409 cluster_managed` even to an authenticated
operator. Update the shared image/StatefulSet and manage migrated model workloads
through the cluster. Stop old host services and cron jobs as part of cutover; this
setting does not stop them. Health responses include `deploymentManager` and the
build commit, but those fields alone do not prove cluster membership. Control
status reports host operations disabled; its empty GPU/model lists are not a
Kubernetes workload inventory.

## Authenticate and check

Use a **node operator session token** from wallet login on your node. An inference API key does
not grant AX administration. Set `AINIZE_OPERATOR_TOKEN` to that session token; do not commit it.

```bash
export AINIZE_URL=http://127.0.0.1:3402
curl --fail-with-body "$AINIZE_URL/api/ax" \
  -H "Authorization: Bearer $AINIZE_OPERATOR_TOKEN"
```

A connected node returns `available: true`, its atespace and the pinned AX revision.
403 means the session is not a node operator; 503 means AX is not configured or reachable.
This check verifies AX API connectivity; task readiness below verifies sandbox provisioning.

## Create a task

Save this as `task.json`. The default image built by the Ainize installer includes Python,
the upstream AX task runner and a command supervisor that records the actual result.

```json
{
  "apiVersion": "ax.io/v1alpha1",
  "kind": "Task",
  "metadata": { "name": "ainize-hello" },
  "spec": {
    "command": ["python3", "/usr/local/bin/ainize-ax-run.py", "--run-id", "hello-1", "--timeout-seconds", "60", "--", "python3", "-u", "-c", "print('Hello from AX')"],
    "resources": { "limits": { "cpu": "1", "memory": "512Mi" } },
    "debug": true
  }
}
```

```bash
curl --fail-with-body "$AINIZE_URL/api/ax/tasks" \
  -H "Authorization: Bearer $AINIZE_OPERATOR_TOKEN" \
  -H 'Content-Type: application/json' --data-binary @task.json
curl --fail-with-body "$AINIZE_URL/api/ax/tasks/ainize-hello" \
  -H "Authorization: Bearer $AINIZE_OPERATOR_TOKEN"
```

Creation returns 201. Reusing the name returns 409; inspect or delete the existing task before
creating another. Check `status.phase` and `status.conditions` for provisioning failures.
A running sandbox does not prove that the command succeeded: AX's default runner stays alive
after command exit. `debug: true` enables the AX CLI's process/file access for inspection;
leave it off for tasks that do not need it.

The supervisor stores `result.json`, `stdout` and `stderr` under
`/workspace/.ainize-runs/hello-1/`. Use the AX CLI built by the installer with your shared
cluster kubeconfig to inspect the actual result:

```bash
AX_CLI="${AINIZE_AX_ROOT:-$HOME/.local/share/ainize-ax}/ax"
"$AX_CLI" -a ainize ssh ainize-hello -- cat /workspace/.ainize-runs/hello-1/result.json
"$AX_CLI" -a ainize ssh ainize-hello -- cat /workspace/.ainize-runs/hello-1/stdout
```

Success means `state: "exited"` and `code: 0`. Other states include `running`, `timed_out`,
`interrupted` and `launch_failed`. Output files are capped at 1 MiB each; the result includes
byte counts and truncation flags. These files are task output and can be modified by task code.
They are not yet ingested into Ainize project runs; `/api/run` still uses its existing backend.

You can also inspect these files through the node's operator API:

```bash
curl --fail-with-body "$AINIZE_URL/api/ax/tasks/ainize-hello/runs/hello-1" \
  -H "Authorization: Bearer $AINIZE_OPERATOR_TOKEN"
curl --fail-with-body "$AINIZE_URL/api/ax/tasks/ainize-hello/runs/hello-1/output/stdout" \
  -H "Authorization: Bearer $AINIZE_OPERATOR_TOKEN"
```

Result inspection requires `AINIZE_AX_ROUTER_ADDRESS`, a `Running` task and `debug: true`.
Responses mark workload-produced data `trusted: false`. The first returns the parsed `result`;
the second returns UTF-8 `text` and its byte count. Use `stderr` to read standard error.
Missing files return 404, incompatible task state 409, oversized files 413, and invalid result JSON 502.
Coordinate reads with suspend operations: Substrate's router may resume an actor that becomes
suspended after the initial state check.

## Suspend, resume and delete

```bash
curl --fail-with-body -X POST "$AINIZE_URL/api/ax/tasks/ainize-hello/suspend" \
  -H "Authorization: Bearer $AINIZE_OPERATOR_TOKEN"
curl --fail-with-body -X POST "$AINIZE_URL/api/ax/tasks/ainize-hello/resume" \
  -H "Authorization: Bearer $AINIZE_OPERATOR_TOKEN"
curl --fail-with-body -X DELETE "$AINIZE_URL/api/ax/tasks/ainize-hello" \
  -H "Authorization: Bearer $AINIZE_OPERATOR_TOKEN"
```

Suspend/resume may take several minutes. Resume restores the workspace into a new process.
The supervisor does not repeat a recorded run ID: a completed result is retained, and an unfinished
run becomes `interrupted`. Review any external side effects before intentionally retrying with a
new run ID. This protection depends on retaining the workspace snapshot. Export the result and
output before deleting the task to release its runtime resources.

## Workspaces and models

POST a `Workspace` resource to `/api/ax/workspaces` to configure Git repositories, files, MCP
servers and skills, then refer to it in a Task's `spec.workspace.name`. POST a `Model` resource
to `/api/ax/models` to configure AX's own Google or Anthropic model with a Kubernetes secret
reference. GET lists resources; GET or DELETE with `/:name` reads or removes one.
All resources use the node's configured atespace. A resource naming a different atespace is refused.
See the [AX manifest reference](https://github.com/google/ax/blob/0f085aa063db6de888e37def7a8943f7901e6c1e/docs/manifests.md)
for the resource fields.

A task's own agent code can call Ainize's model API using the
[normal SDK connection](./call-the-model.md). AX's `Model` resource configures AX's bootstrap
model; it does not automatically make that resource an Ainize inference provider. Use a
cluster-reachable Ainize URL, not the host's `127.0.0.1`, inside a task.

Substrate denies actor egress without an explicit `EgressPolicy`; setting the URL alone
does not allow a connection. The current AX controller does not create this policy.
Provision and validate the actor's permitted destinations through Substrate before enabling
remote model calls or repository downloads. See the pinned
[network egress guide](https://github.com/agent-substrate/substrate/blob/v0.5.0/docs/network-egress.md).
The installer grants model-secret reads only in the Kubernetes namespace named by
`AINIZE_AX_ATESPACE` (default `ainize`); put referenced model secrets in that namespace.

### Manage permitted destinations

Trusted operator-facing peers can expose `GET /api/ax/tasks/:name/egress` and
`PUT /api/ax/tasks/:name/egress`. This requires separate Substrate access:
`AINIZE_SUBSTRATE_ADDRESS=api.ate-system.svc.cluster.local:443`,
`AINIZE_SUBSTRATE_AUTHORITY=api.ate-system.svc`, and mounted files named by
`AINIZE_SUBSTRATE_CA_FILE` and `AINIZE_SUBSTRATE_TOKEN_FILE`. Use the service DNS
CA and a projected token with audience `api.ate-system.svc`. The peer needs
Substrate authorization and the Pod label `ainize.ai/substrate-policy-access: "true"`
for the supplied network policy. The token is reread on every call; TLS verifies
the server certificate. Without this configuration the endpoint returns 503.

Create a policy with an operator-authenticated PUT body such as:

```json
{"rules":[{"tlsPassthrough":{"hostnames":["api.example.com"],"ports":{"numbers":[443]}}}]}
```

Use your approved destination instead of `api.example.com`. Writes support
exact lowercase DNS names and explicit ports for `http` or `tlsPassthrough`.
To replace a policy, GET it first and add `expected` with its metadata `uid`
and string `version` to the PUT body. A duplicate create or stale update returns
409. Empty `rules` denies new connections; changes do not close existing connections.

AX starts task commands immediately. Have the command wait for successful policy
provisioning before accessing the network. This API does not automatically order
project startup or enable AX as the project execution backend.
