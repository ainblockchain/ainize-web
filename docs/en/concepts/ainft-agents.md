---
title: AINFT-compatible agents
summary: Make agents created on Ainize compatible with AINFT and visible in ain-wallet, then support holder conversation, work and growth.
---

# AINFT-compatible agents

The primary goal is **Ainize agent → native AINFT → ain-wallet**: agents created on Ainize must be compatible with AINFT and appear in the existing wallet’s AINFT list and detail screen. The holder can open the agent, talk to it, give it work and help it improve. Connecting an existing AINFT to an agent is a secondary path.

**Status — October 11, 2026:** isolated QA has verified real testnet native minting, numeric token metadata hosting, agent binding, completed Qwen work and recall of an approved private memory. After a real wallet-SDK transfer, the previous holder is rejected and the new holder receives a separate private workspace. A current-source ain-wallet extension loaded in isolated Chromium displays the new holder’s real token, name, image and description, and its conversation button selects the token-specific AINA panel. The encrypted test wallet then signs in through the real extension approval screen. The holder UI completes a real task, saves and approves a private memory, and recalls it in a later model response, without mocked NFT or model responses. The source-running AINA QA panel resolves live Factory metadata, opens the original Ainize companion and completes real wallet-signature login. This uses a browser transport proxy to a loopback QA frontend, not a production AINA deployment. A forged authentication notification followed by a browser-work request is rejected when no AIN SSO bootstrap has succeeded. New token IDs are exact safe integers because the existing metadata host normalizes numeric IDs. Development Factory reward/redemption acceptance passed; production deployment and private model training/application remain unverified or incomplete. The wallet-signed credit client implements catalog, purchase and refund requests, and the holder panel includes benefit history, purchase and refund controls. New purchases stay disabled until the node supports benefit execution. The durable reward and execution bridge is implemented in current source; live development purchase, refund and paid-task settlement have passed.

**Additional verified QA:** tools and handler agents now have real native AINFT registrations. Both completed work, transferred to the recipient, rejected the previous holder with HTTP 403, and exposed a new private workspace containing zero previous tasks. New holder work completed and was visible after opening each token from the recipient's real ain-wallet list and detail screen. The browser used the running AINA QA frontend transport and disabled HTTP/2 diagnostically; Factory responses were direct. These checks do not establish production deployment or default-browser transport reliability.

Private learning remains unfinished. The QA companion now uses a dedicated local serving model and private patch mailbox, with real training enabled. The holder signed a request using the previously reviewed example from approved memory; its TeachWorker job is running under the managed serving/training lifecycle. The dedicated serving model becomes terminal before the trainer starts and must answer again before the runtime is released. The actual serving stop/resource-check/restart/readiness probe passed without changing public model process identities. An earlier separate 20-step training run passed trained questions 4/4 but held-out questions 0/2, and was not adopted. Evaluation, restoration after the active training run, private selection and complete holder UI acceptance remain pending; shared publication has not been requested.

**Production AINA bridge acceptance:** PR #96 was merged and deployed as commit `9498cc40c1ae`, restoring public AINFT navigation while AIN SSO is pending or unavailable. The final wallet PR #6 bundle opened both tools and handler tokens through direct public production AINA HTTPS, completed actual wallet-signature login, and displayed the holder’s completed work. No AINA frontend proxy, Factory proxy or HTTP/2 override was used. One HTTP 401 resource error was observed without blocking either workflow. Wallet PR #6 and the AIN Blockchain guide PR #12 are merged. Chrome Web Store distribution is not yet verified; Ainize companions and Factory credit extensions remain in their QA/development deployments.

**Dedicated serving-model verification:** An isolated GPU model applied every one of the 2,840 exported lesson rows and produced a changed private answer while the concurrent public model retained its baseline answer. All 2,840 rows were then restored, the baseline answer returned, and the restoration journal was cleared. This verifies real application and reversibility on the dedicated QA model. It does not qualify the failed held-out lesson for selection, and holder-triggered training, evaluation and activation remain to be verified.

**Live holder UI restoration:** a real Factory reservation succeeded and its acknowledgement was deliberately withheld once. The QA node was then restarted with its normal configuration. The current holder opened the failed task and restored the allowance using the actual holder-panel button; durable allowance state changed from `reserving` to `restored`, and the task result remained null. The fault preload was removed and the running node’s protected reward configuration was preserved. This verifies the reservation-acknowledgement-loss scenario through the holder UI and a full QA node restart; production release remains pending.

## What is available today

| Need | Existing capability | Integration still needed |
|---|---|---|
| See an Ainize agent in ain-wallet | Native AINFT objects, minting, metadata and wallet account search | Register the agent’s token and confirm wallet discovery |
| Talk to a persona | A served chat model with a prompt agent | Import authorized AINFT persona settings and bind the token |
| Give it work | Tools or handler agents | Token-scoped tasks, requester authorization and private results |
| Keep an existing AI backend | Connect an external A2A agent | An A2A adapter if the backend uses another protocol |
| Find and call the agent | Agent card, marketplace and A2A address | NFT identity and holder access policy on the profile and card |
| Improve it | Knowledge teaching, evaluation and compatible runtime application | Approved holder memories and isolated collection knowledge |
| Earn and spend community credits | AINFT Factory credit, event and store concepts | Verified contribution events and atomic redemption for agent benefits |

For a persona prototype, use [Create an agent from a model](../how-to/create-an-agent-from-a-model.md). For an existing A2A backend, use [Put an agent on a node](../how-to/host-an-agent.md). These workflows create agents; they do not establish NFT ownership or holder restrictions.

## The intended holder experience

1. Create an agent on Ainize using prompt, tools or handler mode. Keep its existing model, code and execution address; every mode exports the same AINFT-compatible metadata.
2. Choose **Register as AINFT** in the planned workflow, choose the supported network and recipient wallet, and approve the required transactions. Create or reuse a registered native AINFT object, mint the token, publish metadata and confirm account indexing. An existing token may be connected instead with the required permissions. The agent page shows token identity and release; the wallet shows the token and opens the agent’s detail page.
3. Talk privately or assign work. Show actual task status, result and errors, and preserve them across restart. A conversational promise is not evidence that a tool ran.
4. Review a proposed memory before saving it. Choose private holder memory or an explicitly approved community contribution. Do not publish chat or files by default.
5. Inspect growth evidence, achievements and community credits. Reward completed work or approved contributions according to the collection's versioned policy; duplicate requests do not earn duplicate rewards.
6. Redeem credits for a published benefit, such as a task allowance or a community feature. Show the cost, entitlement and refund rule before purchase.

This is the target workflow, not a sequence of currently available NFT controls. Registration is an explicit transaction flow, not a side effect of saving an agent. Keep existing tokens and metadata when connecting an existing AINFT; no reminting is required for that path.

## Compatibility with the existing ain-wallet

The wallet reads the selected network’s configured `nftServerUrl`, queries the active wallet account and groups tokens by `ainftObject.id`. It does not read the Ainize agent catalogue. Native AINFT registration and Factory ownership indexing are therefore required; an agent card or NFT-shaped JSON export alone will not appear in the wallet.

The current installed wallet calls `nft.searchNfts({ userAddress, limit: 100 })` and consumes `nfts` rows containing `ainftObject.id`, `ainftObject.name`, `tokenId`, `tokenURI` and `metadata`. Preserve this consumer contract, even where newer SDK documentation names the search method `searchAinfts`. Handle pagination so a token after the first 100 results remains discoverable.

| Field or behavior | Requirement |
|---|---|
| `metadata.name` | The agent’s display name |
| `metadata.description` | A public description of the agent |
| `metadata.image` | A public avatar the existing wallet tile and detail screen can load |
| `metadata.external_url` and `ainize.detailUrl` | The human-facing `/agent/<id>` page, not the `/agents/<id>` A2A endpoint |
| `metadata.ainize` | Versioned agent identity, model, release, A2A URL, card URL and access/growth policy |
| Network and recipient | Matching AIN chain, RPC and NFT server; an explicitly verified recipient wallet for an SSO-created agent |
| Wallet navigation | A safe HTTPS Open agent action; invalid or absent extension metadata preserves legacy display and Send |
| Transfer | Existing native AINFT Send remains usable and ownership indexing moves the token to the new account |

Show registration progress separately from agent readiness: waiting for signature, chain confirmation, metadata publication, Factory indexing and wallet visibility. Retrying a failed registration must not mint twice or delete a working agent. Private keys remain in the signing wallet. A completed registration requires reading the published metadata and finding the token through the same account query the wallet uses.

The original wallet displays name, image and description and supports Send. The Open agent action and native AINFT metadata compatibility are implemented in merged wallet PR #6 and verified with its final extension bundle. Chrome Web Store distribution remains unverified. Existing AINFTs without agent metadata retain their ordinary display and send behavior.

## Ownership and access

The wallet session proves control of an address. A fresh chain read proves token ownership. Holder actions require both and must refuse execution when ownership cannot be verified.

Token holder, collection administrator and agent operator are different roles. A holder can use holder features; the collection administrator publishes metadata under the existing collection rules; the operator manages agent code and deployment. Current hosted agents retain their creator as `owner`. Token transfer does not currently change it automatically.

**Agent visibility controls listing, not holder-only execution.** A private or unlisted URL is not a holder access gate. The integration must check ownership on direct A2A calls, streaming, task reads and peer relay, as well as the web interface. An agent card may be public while execution is authenticated. Recheck ownership before queued work performs a privileged action or returns a private result.

When a token transfers, revoke the old holder's privileges and establish a new private workspace for the new holder. Public token achievements may remain. Previous private conversations, personal memories, files, credentials and wallet credit balances do not transfer. Shared collection knowledge is a separate artifact with its own publication consent.

## Direct A2A holder calls

The local native AINFT binding activates holder authorization at `/agents/<id>`. Its public card advertises A2A 0.3 and the methods `message/send`, `message/stream`, `tasks/get` and `tasks/cancel`. Calls use the same private wallet-scoped tasks as the web workspace. A new holder cannot read the previous holder’s task IDs or reuse its conversation context. Binding a token changes this address from the ordinary public agent execution path to the holder companion path.

Authenticate with the native wallet login session or a fresh `x-ainft-auth` request proof in the format `<address>:<timestamp>:<signature>:v2`. The signature uses the core request-bound authentication format with purpose `ainft`, the destination node address, HTTP method, destination path, timestamp and exact serialized body. The card’s `urn:ainize:ainft-holder-auth:v1` capability extension supplies the destination identity. The mesh relay preserves this destination proof; its own node signature does not grant NFT holder rights. Changed bodies, wrong destinations and reused proofs are refused.

A stream delivers the task, result artifact and final status. It rechecks ownership before returning the private result. Cancelling queued work prevents execution; already executing work cannot claim safe cancellation. Private and organization-listed agents can be opened by their current holder without granting access to the creator’s prompt, code or secrets. If the agent version changes, update the token metadata and binding before continuing holder work; the token is not minted again.

## Bind metadata without replacing it

AINFT's specification maps to the persona, model, capabilities and agent release. Its history maps to approved outcomes and contribution evidence. Its properties map to levels and achievements under a collection policy.

The proposed additional metadata field is `ainize`, with `schemaVersion`, `agentId`, `detailUrl`, `agentUrl`, `cardUrl`, `model`, `release`, `access` and `growthPolicy`. This is a proposed convention, not a field already accepted by the hosted-agent API. The binding record must also identify the token's network, collection and token ID.

Preserve the collection's existing fields when publishing metadata. The existing AINFT metadata tutorial requires the object owner, who may differ from the token holder. Confirm the transaction and read the metadata back before displaying a completed connection. See the [AIN Blockchain integration specification](https://github.com/ainblockchain/docs/blob/main/ai-agents/ainft-agents.md) for the proposed metadata example and permissions.

## Review private learning examples

In the holder workspace, choose **Review learning example** beside an approved memory. Edit the question and answer, review both, and explicitly consent to saving them. The example is private to that agent and wallet, persists across restart, and uses a retry-safe submission key. Saving an example does not start model training, publish its data or award experience or credits.

Withdraw an example to exclude it from future training selection. Revoking its source memory also withdraws every related example. These actions do not claim to erase past conversation or undo model training. A transferred token does not give the new holder access to the previous holder’s examples. Model improvement requires compatible training, evaluation and explicitly selecting the evaluated lesson for subsequent conversations.

Use **Check model training** to inspect the current local runtime. Training is available only when the agent uses the exact local model and serving endpoint used by a real gradient trainer. Peer models, mismatched backends and simulated trainers are refused. Select reviewed examples and explicitly consent to training. The node submits those question-and-answer rows to TeachWorker and persists its job identifier; status comes from that worker. If submission acknowledgement is lost, the same request is not replayed and the operator must reconcile its outcome. Training may record the wallet address, status and dataset hash on a configured blockchain; the example contents are not automatically published. Hosted chat uses the shared runtime lease so it waits while a lesson is temporarily evaluated. An evaluated draft is not automatically activated in the companion. For a READY job with active reviewed examples, choose **Choose this lesson**, review the change and explicitly consent. Each subsequent local holder model call applies the selected lesson under the shared runtime lease and restores every journaled row after the response. **Return to base behavior** stops using that lesson while keeping training records and approved memories. Withdrawing any selected example or changing the agent release invalidates the selection; the node never silently falls back to an older lesson. A missing or failed restoration blocks shared generation and is retried after restart. Selection history stays private to the wallet and agent. Code agents using the hosted SDK model door receive the same private turn scope. A selected local lesson refuses peer-model fallback if its local model is unavailable. Community-credit integration remains incomplete; real model application and restoration still require deployment acceptance testing.

## Review shared publication

For an eligible READY lesson, choose **Review shared publication**. Review the name and description, then separately confirm permanent publication and your rights to publish. This flow publishes a free CC-BY-4.0 learned knowledge file, keeps original examples private, and provides no payout share or credit reward. The public file contains learned content even though its original rows remain private; publication cannot be guaranteed withdrawable.

**Sign in wallet and submit publication** asks the signed-in holder’s AIN Wallet to sign the Teach claim. Wallet or session changes before submission refuse the request. Teach signature verification and operator review policy still apply. Submission may still need operator approval; only ANNOUNCED means it has been announced. Intent persists before submission, and a new request key cannot resubmit the same training run. An unknown outcome requires operator reconciliation.

## Growth means evidence

Private conversation history, retrieval memory and a trained model patch are different things. Saving a message does not mean the model learned it. Approved memory must influence a later answer in the correct holder scope. Shared training must pass evaluation and be applied to a compatible runtime before it is described as a model improvement. Failed training keeps the last working release.

Use [Teach from a file](../tutorials/teach-from-a-file.md) for the existing training workflow and [What verified proves](./verification.md) for its limits. The [agent memory guide](../how-to/agent-memory.md) describes a separate memory-capable agent workflow; it does not automatically give a hosted AINFT companion memory.

The holder workspace shows the `activity-v1` policy and the latest 20 recorded growth events. Completed conversations or work and first memory approvals each contribute one experience point. Visible source work and memories can be opened from the record. Revoking a memory keeps its historical activity point and marks it inactive. Records stay private to the agent and wallet across restart.

Version the experience and reward policy. Track unique task and contribution events, and award each event at most once. A level reports progress under that policy, not proven answer quality.

## Credits and execution cost

After binding the current release, the creator can use **Community credit connection** to select an existing Factory app and credit symbol or disconnect them. Settings persist with a version check and survive a binding refresh. In the holder workspace, enter the linked Factory user ID and choose **Check balance with wallet**. One AIN Wallet signature calls a dedicated holder balance endpoint. The legacy Factory read endpoints require an app-owner signature and cannot serve ordinary holder wallets. The new endpoint must be deployed before holder reads work. The Factory checks that the user’s primary address or an explicitly linked address matches the signed wallet before and after reading its balance. The node verifies current ownership before and after these reads, and changed account, network or community configuration discards the result. Zero is a valid balance; unavailable or malformed responses are errors. This read is a balance snapshot. The separate reward and redemption integration passed development acceptance described below.

The development Factory extension records versioned benefit policies, unique contribution rewards, purchases and task allowances against the existing credit balance. Purchase debit, escrow and receipt are saved together. A task reserves its allowance before execution; confirmed success settles the payment, and a known failure can restore the allowance. Unused purchases can be refunded within their recorded window. Concurrency, lost replies and role enforcement have been tested with an isolated Firebase database emulator. This extension is deployed on the development Factory; production deployment remains pending. Current node source connects it to hosted task execution. The holder purchase/refund panel is implemented locally: it saves a purchase intent before signing, preserves the key across reloads and clears an uncertain intent only after a matching catalog receipt. New purchases require node-confirmed benefit execution support; history and unused-purchase refunds remain available when the Factory supports these routes. Actual Factory rewards and purchase/refund/usage passed development acceptance. Credit UI reads passed using actual public Factory responses through a transport proxy and in a direct HTTP/1 browser comparison; the default browser transport still needs investigation.

Factory community credits, AIN, x402 payments and training or GPU budgets are separate units. Holding a token or earning credits does not make inference or training free. A collection must define how a redeemed benefit pays for its execution.

Rewards require authenticated evidence and a unique event ID. Redemption requires an atomic balance check and debit, an entitlement and a refund rule. Retries must neither issue duplicate rewards nor spend twice. Existing [payment](./payment.md) behavior is not automatically a Factory credit adapter.

## What must pass before release

First, create an agent in each hosted mode on Ainize, register its native AINFT, and verify the existing wallet can list it, display its metadata, open the agent and send the token to another account. Confirm new-holder discovery and old-holder revocation. ERC721 coverage does not replace this native wallet test. Both native AINFT and ERC721 bindings must preserve metadata. Holder chat and real tasks must work and survive restart. Non-holders must be refused on every execution route. Transfers must revoke old-holder access without leaking private state. Approved memories must affect later answers in the right scope; shared training must be evaluated before activation. Growth and credit events must be replay-safe, and redemption must be atomic. The metadata and agent page must agree on the token and release. The web interface must expose binding, access, conversation, tasks, memory approval, growth and credits with accurate failure states.

Until these checks pass, treat a persona prototype as an ordinary Ainize agent, not a completed holder-controlled AINFT companion.

The opt-in native testnet registration tool in `ainize-web-unified/scripts/ainft-testnet-qa.ts` requires `AINFT_LIVE_AGENT_URL` (the real published `/agent/<id>` URL), `AINFT_LIVE_IDENTITY_FILE` (a private test-wallet file) and `AINFT_LIVE_SDK_PATH` (the installed AIN SDK). It reads the live metadata and agent card, checks their release and endpoints, and pins the metadata alongside retry-safe registration state. It refuses a different saved agent or changed metadata. Registration evidence reports binding, wallet display and transfer as unverified until those separate checks are performed. This tool does not create a placeholder agent or prove the complete holder experience.

### Credit integration in the current source

The node now connects the reward dispatcher and paid-task execution engine when an operator supplies `AINFT_REWARD_CONFIG_FILE`. Configuration and signing-key files must be owner-only regular files outside agent data; agent metadata cannot provide credentials or grants. A holder enrolls a linked Factory user through `POST /api/hosted-agents/{id}/companion/credits/enroll` after active-policy, wallet-mapping, live ownership and unchanged-binding checks. `GET .../credits/rewards` reports delivery state only to the current holder. Completed work and first memory approvals save reward intents with the private event, retain their original policy version and retry the same Factory event after a lost reply. Changing the binding release or community configuration stops new rewards under the old enrollment.

The holder panel implements enrollment, delivery status, purchase history, purchase/refund and allowance selection. New purchases require the current policy in the server’s allowed versions; existing purchases retain their recorded policy version. Paid task requests contain `purchaseId` and `purchasePolicyVersion`. The request key is saved before submission without storing the private prompt. A matching task acknowledgement clears it. The node reserves an allowance before invoking the agent, records its completed result before settlement and keeps that result if settlement is pending. `POST .../tasks/{taskId}/settlement` retries only settlement. Interrupted execution is not replayed or automatically restored.

On October 11, 2026, the separate Ainize QA companion was redeployed with protected operator configuration and the development Factory integration. Actual creator and holder signatures configured the community and enrolled rewards. Three completed tasks each earned one credit. Holder-signed requests purchased two task uses for 2.5 credits, refunded an unused purchase, and purchased another allowance that completed and settled real model work. These are live development results. Credit balance, purchase history and remaining allowance were rendered after real wallet approval using actual Factory responses, including a direct HTTP/1 comparison. Default browser transport, other hosting modes, private model training/application and production deployment still require verification.


### Allowance recovery in current source

Holder workspace responses report each paid task’s allowance state and whether restoration or settlement is available. The holder panel offers **Restore reserved allowance** for stopped, never-executed tasks and **Retry settlement confirmation** for completed work awaiting settlement. `POST .../tasks/{taskId}/allowance/restore` reconciles a lost reservation acknowledgement with the original task identity, then restores its allowance without executing work. Lost restoration replies can be retried safely. Executed or uncertain work is refused; an uncertain outcome requires operator reconciliation. These API branches passed ten server tests, and the node and web builds passed on the ainize SSH server. A separate Factory QA image built against the current development runtime and passed both credit and native-signature test files with networking disabled. These isolated checks do not prove production deployment; separate live development credit acceptance is described above.
