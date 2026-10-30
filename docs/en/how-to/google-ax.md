---
title: Run agents with Google AX
summary: Install Google Agent Executor alongside Ainize and create, inspect, suspend and resume sandboxed agent tasks.
aincode: false
---

# Run agents with Google AX

> **Merged, not yet enabled on ainize.ai.** The AX integration landed in ainize-node `main` with
> [PR #251](https://github.com/ainblockchain/ainize-node/pull/251) on 2026-10-30. It stays off until an
> operator sets `AINIZE_AX_ADDRESS`; the `/api/ax` routes answer 503 before that. The operator path was
> verified end to end on a kind cluster (`deploy/ax/dev-kind.sh` + `deploy/ax/sample-task.sh`): a Python
> command ran in a gVisor sandbox and its result came back through the node. Substrate workers need a
> Linux kernel of 6.5 or newer, so the shared production cluster still awaits worker hosts with such a
> kernel. The code includes explicit project-run admission, delegated model calls and AinDrive file reads.

[Google AX](https://github.com/google/ax) runs agent tasks through Agent Substrate on Kubernetes.
**Hosts providing AX execution share one Kubernetes cluster under a trusted administrator.** Kubernetes and Agent Substrate
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
the agent execution environment. The operator AX API described here is implemented in that preview;
explicit AX-selected script runs now connect to the project worker after signed SSO approval.
Existing runs do not switch backends automatically.
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
cross-peer AX dispatch and production validation remain unfinished.

## How Ainize-node relates to Node.js, Docker and Kubernetes

**Ainize-node is the application that participates in the peer network.** Node.js
runs that application. Docker provides containers for workloads. Kubernetes
manages container workloads across cluster hosts. Installing Kubernetes is not a
requirement for running an Ainize peer.

| Environment | Where Ainize-node runs | How work is executed | Kubernetes required? |
| --- | --- | --- | --- |
| Node.js only | A process on your computer or server | Requests supported work from another authorized execution peer; has no local Docker/AX sandbox | No |
| Node.js and Docker | Usually a host process; packaging the peer itself in a container is optional | Uses local Docker for supported builds and application deployments | No |
| Kubernetes cluster | A Pod in the cluster | Uses cluster execution services; AX uses Agent Substrate in this cluster | Yes, for this deployment option |

### 1. Node.js only: participate and request work

A laptop without Docker can run Ainize-node as a Node.js process, connect to
other peers, and use supported remote APIs. It cannot offer a local Docker
sandbox simply by joining the network. For example, an authorized request can
be sent to a peer that provides the required execution capability. Provider
availability and permission must both be checked.

### 2. Docker host: also provide local execution

A server can run Ainize-node as a Node.js process and let it call Docker to build
and run supported workloads, including the existing application deployment path.
The peer process and its application containers are separate: using Docker to
run projects does not mean Ainize-node itself must be inside a container.
If the peer is packaged in a container, its runtime dependencies, persistent
state and access to the host execution service must also be configured; the
prepared Kubernetes peer image alone is not a complete Docker-host deployment.

### 3. Kubernetes: share a managed execution cluster

In the shared-cluster deployment, Ainize-node runs in a Pod. Its approved
execution requests reach cluster services through a controlled API path.
Kubernetes places workloads on suitable workers; AX and Agent Substrate provide
the agent execution environment. A peer Pod does not need its own Kubernetes
cluster, and each peer does not automatically receive cluster-admin credentials.

The planned Kubernetes application backend will preserve Next.js builds and
deployments. That backend is still pending; moving a peer into a Pod does not provide
Next.js hosting. AX-selected script execution is configured separately below.

### Dedicated model hosts can keep Docker

A server dedicating all eight GPUs to one long-running model can retain its
Docker deployment while AX and shared application jobs use Kubernetes. Keep
native model processes as such until a separate container migration is tested.
Choose based on actual GPU allocation, model storage and restart requirements;
GPU count alone does not establish which host should move.

Record retained machines in the cluster inventory's `externalHosts` with their
observed `docker` or `process` runtime and a reason. Only machines in `hosts`
receive cluster join configurations. Both groups remain in the same peer network.

### Eight busy GPUs can still leave room for application workloads

GPU, CPU and memory are separate resources. A model using all eight GPUs may
leave CPU and RAM for Next.js, TA or API workloads on the same server. Reserve
the model's CPU/RAM needs, host overhead and peak headroom first; offer only the
remaining capacity. Also test disk and network contention under concurrent load.

Two arrangements are possible: run both workload types through Docker, or retain
the model in Docker while the host joins Kubernetes for CPU-only applications.
For the mixed arrangement, keep the host in `hosts` and use `retainedWorkload`
to declare its external GPU ownership and CPU/memory reservation. The planner
emits kubelet reservation arguments and rejects missing reservations or NVIDIA
GPU resources advertised to Kubernetes. Operators must separately configure
model cgroup limits, exclude the host from GPU device-plugin allocation and
restrict Pod device access. These checks require live validation before use.

A host belongs in `externalHosts` only when it remains entirely outside
Kubernetes. Eight occupied GPUs alone are not a reason to exclude the whole host.

For retained Docker hosts, the preview branch supports
`AINIZE_PROJECT_HOST_RESERVATIONS=/etc/ainize/host-reservations.json`.
The operator-owned JSON specifies `cpuCores`, `memoryHeadroomMiB` and `gpuUuids`.
Memory is additional free-memory headroom beyond current usage; list every
model-owned GPU even when idle. Invalid or missing configuration refuses new
admissions. This per-peer budget does not install cgroup limits or coordinate
multiple peers on the same host. See the
[host reservation example](https://github.com/ainblockchain/ainize-node/blob/feat/google-ax/deploy/cluster/README.md#share-cpu-and-memory-while-retaining-a-gpu-model).

### Peers and execution resources are separate

All three deployments participate in the same peer network. A peer without a
local sandbox must not advertise one or run untrusted jobs directly on the host
as a fallback. Remote execution still requires the selected provider's supported
API, authorization and capacity. Automatic remote AX project execution is not
yet connected; discovering an AX-capable peer does not route a project run to it.

One organization can have several independent node contributors. For example,
Hanyang, Inha and Sookmyung can contribute three peers to the single
GenAI-Leader-Finance-ComCom organization. Members retain the organization's shared
project execution/redeployment permissions; contributor identity distinguishes
node operation, supplied resources and accounting. It does not create three
separate school access boundaries.

## Prepare the shared cluster

First inventory the hosts, live peer identities, existing deployments and persistent data. Follow the
[shared cluster guide](https://github.com/ainblockchain/ainize-node/blob/feat/google-ax/deploy/cluster/README.md)
to generate one kubeadm initialization configuration and worker join configurations using the same
API endpoint and pinned cluster CA. The supported configuration uses Kubernetes v1.37.1 and enables
the certificate features required by Substrate. The plan generator checks existing network ranges,
duplicate identities and complete host membership. Generating a plan does not migrate live workloads.

Once all selected cluster hosts are Ready, configure persistent storage, cluster networking with NetworkPolicy enforcement,
a registry accessible from every worker, and the Substrate operator installation document. Follow the
[AX installation guide](https://github.com/ainblockchain/ainize-node/blob/feat/google-ax/deploy/ax/README.md)
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

## Run a project script with AX (preview)

This flow uses a project owner/member session. The operator API in the next
section is a separate interface. Organization members may run each other's
projects under the organization's shared permissions; contributing a node does
not grant another organization's project access.

### Operator setup

Register the organization tenant and bind the project using the
[tenant setup instructions](https://github.com/ainblockchain/ainize-node/blob/feat/google-ax/deploy/ax/README.md#bind-a-controller-to-a-tenant).
Enable `AINIZE_AX_TENANT_REGISTRY=true` and `AINIZE_AX_PROJECT_ADMISSION=true`,
configure AIN SSO, `AINIZE_AX_CLUSTER_UID` and the exact HTTPS
`AINIZE_AX_PROJECT_ORIGIN`, and set `AINIZE_AX_PROJECT_EXECUTOR_FILE` to the
operator-owned executor JSON. It specifies digest-pinned Python/Node images,
CPU/memory limits and registered tenant egress policies. Configure the AX,
guest-router and authenticated Substrate endpoints as described in
[executor setup](https://github.com/ainblockchain/ainize-node/blob/feat/google-ax/deploy/ax/README.md#configure-the-project-executor).
Enabling admission without an executor leaves runs queued.

### Submit and approve

1. With your project session, POST `/api/projects/<projectId>/ax-runs`:
   `{"target":"commit","sha":"<full-commit-sha>","entry":"main.py"}`.
   Use `dataRequired: true` as an additional field if the program needs admitted
   files at startup. The response includes `runId` and `approvalPath`.
2. Obtain an AIN SSO `invoke` delegation for that exact run and its possession
   proof for POST to `AINIZE_AX_PROJECT_ORIGIN + approvalPath`. A login session
   alone is not a run delegation.
3. POST `{"token":"<delegation>","proof":"<possession-proof>"}` to
   `approvalPath`, with the same project session. This acknowledges admission,
   not successful execution. A data-required run also waits for step 4 below.

The worker checks approval before cloning, verifies the task's egress policy
before release, and persists the output/exit result before cleanup. It checks
permission again while running, including while waiting on guest reads. Loss of
permission cancels observation and triggers cleanup or suspension for recovery.
This does not guarantee termination during controller or network failure.
Only script execution is connected: this flow does not deploy a Next.js service,
accept arbitrary project secrets, or enable automatic cross-peer AX dispatch.

### Optional model calls

The operator sets `AINIZE_AX_BROKER_MODELS_FILE` to a JSON map from supported
model IDs to their exact SSO resource identifiers, and configures
`AINIZE_AX_BROKER_ISSUER` and `AINIZE_AX_BROKER_JWKS_URL` for Substrate workload
identity. These are separate from AIN SSO user identity. Add `broker.origin`
(equal to the project origin) and `broker.caBundleFile` to the executor JSON.
The PEM bundle must include the gateway interception CA and required public CAs.
See the [model broker configuration](https://github.com/ainblockchain/ainize-node/blob/feat/google-ax/deploy/ax/README.md#model-broker).

The run delegation must also grant `invoke` on the selected model resource.
The executor injects `OPENAI_BASE_URL`, a placeholder `OPENAI_API_KEY` and CA
settings. An OpenAI-compatible client can use these variables with `stream: false`;
the gateway replaces its Authorization header with a short-lived actor JWT.
The guest receives no internal account key. Model calls are checked against the
current run approval and existing account/model/usage rules.

### Optional AinDrive files

The operator also sets `AINIZE_AX_AINDRIVE_ORIGIN` to the exact HTTPS AinDrive
origin; the broker configuration above is required. For a data-required run:

1. POST `{}` to `/api/projects/<projectId>/deployments/<runId>/ax-data/key`.
   Use its `publicJwk`, `agent` and `audience` to obtain a separate SSO data
   delegation for the same subject/organization and exact file `read` resources.
2. POST the data token, selected `resources` and exact `files` to
   `.../ax-data/grants`. Follow the [request format](https://github.com/ainblockchain/ainize-node/blob/feat/google-ax/deploy/ax/README.md#optional-aindrive-data-access).
   Supply real AinDrive path-derived file IDs; include a revision only if the
   origin provides one. The response returns immutable file reference IDs.
3. Repeat for other grants if needed. A run invocation grant alone cannot read files.
4. POST `{"grantIds":["<delegationId>"]}` to `.../ax-data/ready` to freeze the
   selection and enqueue execution. Limits are 64 grants and 64 total files.
   A different selection requires a new run.

The guest reads the token-free manifest at `AINIZE_AX_DATA_MANIFEST`:

```python
import json, os, urllib.request

with open(os.environ["AINIZE_AX_DATA_MANIFEST"]) as source:
    files = json.load(source)["files"]
request = urllib.request.Request(files[0]["url"], headers={
    "Authorization": "Bearer " + os.environ["OPENAI_API_KEY"]
})
with urllib.request.urlopen(request) as response:
    file_data = json.load(response)  # content, encoding, mime, bytes
```

Check `encoding` before consuming `content`; binary files use base64. Each read
checks the current run, data grant and AinDrive ACL. To disable one stored grant,
POST `{"delegationId":"<id>"}` to `.../ax-data/revoke`. This local action does not
revoke the SSO token in other services or recall already returned bytes.
Only AinDrive file reads are connected; directory listing and AIN Teams/AIN Mem/
AINA data adapters remain unfinished. Live gateway TLS, production AinDrive
access and shared-cluster isolation have not yet been verified.

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

For controller integration, the supervisor also supports
`--wait-for-release-seconds N` before `--`. It waits for a release matching a fresh
invocation challenge before starting the command. A previous invocation's release
cannot unlock a restarted wait. This is launch coordination, not tenant authorization;
the trusted controller must verify task ownership, egress and file grants first.
The internal launcher can send a checked release through the guest protocol;
the configured project executor now orders approval, policy checks and release. See the
[launch-gate protocol](https://github.com/ainblockchain/ainize-node/blob/feat/google-ax/deploy/ax/README.md#gate-a-command-until-policy-setup-finishes).

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
Manually created operator tasks are not project runs. The project executor persists
AX-selected run results separately; `/api/run` keeps its existing backend.

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
