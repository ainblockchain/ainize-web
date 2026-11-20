---
title: A QA agent for your repository
summary: Register an agent that sits in an AIN Teams channel, turns a posted request into a fix for one GitHub repository, runs the repository's checks and opens a pull request an approver approves — with an API key, without touching the node.
aincode: false
---

# A QA agent for your repository

People who use your product post what is wrong in a channel. A **QA agent** reads the post, changes the code,
runs your checks on the change, opens a pull request, and waits for the person you named to approve it. It is an
ordinary Ainize hosted agent — it has a page at `/agents/<id>` and is a member of your AIN Teams workspace — plus a
pipeline the node runs for it.

The quickest way to set one up is to ask Claude Code ([Use Ainize from Claude Code](./claude-code-skill.md)). This
page is what happens, so you can do it by hand or check what was done.

## QA agent standard

Start with a [tool-calling agent](./create-an-agent-from-a-model.md). Bind its repository and channel using the registration steps below. Give it scoped tools to read the source thread, inspect the repository, validate changes, read the deployment Run and retrieve the production replay result. The model uses the report, attachments and earlier attempts to choose its next tool and compose its reply. The harness enforces repository and channel scope, approval, call limits, deduplication and posting permissions.

| Event | Evidence the harness must check | Destination and content |
|---|---|---|
| Accepted | A durable job linked to the source message ID | Reply once in the original QA thread, identifying the reported symptom. |
| Tool, model, check or deployment failed | Job ID, failed stage, Run link and exit code when available, redacted final output | Record the error in `#monitoring-agents`. Suppress intermediate replies in the QA thread. |
| Fix verified | Successful Run for the target commit, healthy service, matching serving commit and passing replay of the original user action | Reply once in the original QA thread with what changed and how it was verified. |

Give the model the report and verification results before publishing. Acceptance and completion are event types. Generate the wording for each report. Preserve errors and retry when a model or lookup fails. Link the new Run to the earlier failure and replay unresolved cases after repairing the agent. A pull request or passing unit checks alone cannot establish completion.

For acceptance testing, exercise an unfamiliar paraphrase, duplicate delivery, model timeout, serving commit mismatch and a deployment where the original symptom persists. Inspect tool calls and publication counts in a test channel. Failures should produce monitoring records. After recovery the original thread should contain one acceptance and one verified completion.

### Publishing an issue discovered by a QA agent

Bind the reporter's identity to its workspace and QA channel. Give the model a read tool that returns the whole draft as numbered source excerpts. Ask it what the writer is doing and which excerpt shows the observed problem. The harness checks that the selected excerpt actually came from that draft before allowing a new top-level report.

“I clicked Save, saw ‘Saved’, then reloaded and the card was gone” raises an issue. A tester comparing a game character’s answer with a historical source can also raise an issue. “You reported that the card disappeared. I’ll investigate” acknowledges an existing request. Keep acknowledgments in their original thread. Send tool failures to `#monitoring-agents` and retain the original request for retry.

Keep locally generated fixes linked to the original message, repository, base commit and candidate commit. Submit the candidate through the repository’s review and Ainize Run workflow. Close the issue only after replaying its original steps on the serving commit.

## What you need

- An organization the node's operator **admitted to QA**. The agent runs your repository's code on the node and
  opens pull requests with the node's GitHub account, so the operator decides whose repositories it takes.
  `GET /api/orgs/<org>/qa/access` answers `allowed`.
- A GitHub repository the node's QA account can write to.
- An organization API key, and a member of the organization who can sign in to AIN Teams and Ainmem.

## 1. The repository names its agent

Add to the repository's `ainize.json` on the branch the agent works from:

```json
{
  "qa": { "agent": "myapp-qa" },
  "checks": [
    { "name": "type-check", "command": ["npm", "run", "type-check"] },
    { "name": "test", "command": ["npm", "test"] }
  ]
}
```

`qa.agent` is consent: an agent can only be registered for a repository that names it. `checks` are the gates a fix
must pass. They are the same [`checks`](./deploy-with-ainize-json.md) a deployment runs, so you write them once.
Each runs in a container with your dependencies installed and no network. A check that already fails on the branch
is not counted against a fix.

## 2. A channel and a board

- In AIN Teams, a channel for requests (`qa-myapp`).
- In Ainmem, a board where each request becomes a card: a title, a status with the options queued, coding,
  validating, blocked and completed, and a link back to the request.

## 3. Register

```bash
curl -s -X POST https://ainize.ai/api/qa-agents -H "Authorization: Bearer $(cat .ainize_key)" \
  -H 'content-type: application/json' -d @register.json
```

The body names the agent (`id` ending in `-qa`), the organization, the repository and branch, the Teams channel,
the Ainmem board, and the approvers — each an AIN SSO account with its AIN Teams user id. The node reads the
repository, checks that it names this agent, takes the gates from `checks`, and creates the hosted agent as you.
The fields are in the [HTTP API reference](../reference/http-api.md) under `/api/qa-agents`.

| Field | What it decides |
|---|---|
| `approvers` | Who may approve a fix. An approval is a reply in the thread, a comment on the card, or the approval button. |
| `autoMerge` (default `true`) | Whether an approved pull request is merged into the branch. Turn it off when a push to the branch does something you want a person to trigger — publishing to a store, a migration. |
| `limits` | Memory, time and CPUs for one check, when the defaults (4 GB, 5 minutes, 2 CPUs) are not enough. |
| `runEvidence` (default `false`) | Start the app before and after the fix and attach what it answers. Only for an app that starts with no network, no database and no secrets. |
| `deployment` | Where the running revision can be read, so a request is closed only when the fix is serving. |

## 4. The agent's two identities

Import the agent into the workspace (**Agents → Invite agent**) and add it to the channel; create its credential
for the board. Each gives a token once. Hand both to the node:

```bash
curl -s -X PUT https://ainize.ai/api/qa-agents/myapp-qa/tokens/teams  -H "Authorization: Bearer $(cat .ainize_key)" \
  -H 'content-type: application/json' -d '{"value":"…"}'
curl -s -X PUT https://ainize.ai/api/qa-agents/myapp-qa/tokens/ainmem -H "Authorization: Bearer $(cat .ainize_key)" \
  -H 'content-type: application/json' -d '{"value":"…"}'
```

They are write-only. The agent uses them to answer in the thread and update the card; the node keeps its own copy
to re-read the request, the membership and the approval itself, so nothing rests on what the agent says.

### Deciding when reports share a fix

Deliveries with the same verified message ID refer to the same request. For different messages, have the harness check the channel, author, requested access and attached file IDs before offering candidate jobs to the model. Let the model read each report and compare the target, symptom and expected result. To join an open job, require a quote from each source that supports the same fix. If the model times out or the sources leave the answer unclear, keep the new report open independently. Test two similar URLs whose paths differ only in case and two requests that change different behaviors of the same control.

## Distinguishing review approval from resolution

A reviewer can approve a code change while the old version still serves traffic. Give the model separate tools for reading the approval, checking the Run and reading the original production replay. An approval such as “LGTM” belongs to the review for its candidate commit. Keep polling the deployment until the serving commit and original acceptance test are verified. If a reporter explicitly confirms that their symptom is gone, record the reporter’s exact words and identity. Keep that confirmation distinct from the agent’s independently verified fix. To recover an incident closed on approval alone, re-read the original thread, preserve the existing candidate and prior notifications, and resume verification.

## Reading an attachment from a QA report

Open the original message with `read_thread`. Each entry in `files` identifies an attachment on that message. A filename and MIME type can help the model choose an inspection tool. Reproducing a gesture shown in a screen recording requires inspecting the recording itself.

If QA needs file contents, a signed-in Teams workspace member can reissue the agent credential with `POST /api/agents/<teams-agent-id>/token` and the JSON body `{"workspaceId":"<workspace uuid>","scope":["files:read"]}`. Use the agent's **Teams** ID from the invitation. Include any additional optional scopes the existing integration still needs. Reissuing immediately revokes the old credential. Coordinate the change with ongoing jobs and copy the new credential privately into the Ainize Teams token setting above.

Call `create_file_download` with the file ID from the verified message. Check channel membership and the message-to-file binding before opening the returned link. Keep the token and temporary download URL out of prompts, chat and logs. If Teams returns `403 missing required scope: files:read`, record the original message ID, tool name and error in `#monitoring-agents`. Once access is restored, retry that same report and compare the production behavior with the attachment before posting completion.

## 5. When it starts working

| `state` | Meaning |
|---|---|
| `needs_tokens` | Registered; a token is missing. |
| `pending_restart` | Complete. The node reads QA settings when it starts, so the agent serves the channel from the next release. |
| `active` | Serving the channel. |

Post a small request in a test channel and trace its job from receipt through approval. After merge, the designated deployer opens [Runs](/runs) and selects the project serving the production domain. Start the production deployment for the reviewed 40-character main commit SHA, or open the existing Run for that release. Record its ID. If the deployment control is missing, check the project binding and deployer access. Follow the [illustrated Run guide](./deploy-with-ainize-json.md) to inspect the stages and failure logs. Send the completion reply once the Run succeeds, the production health check passes, the serving commit matches the target, and the originally reported action passes on that domain.

## If something is off

| What you see | Why | What to do |
|---|---|---|
| 403 `qa_not_enabled` | The organization is not admitted to QA. | Ask the operator. |
| 422 `repository_unreadable` | The node's QA GitHub account cannot read the repository. | Add it with write access. |
| 422 `repository_not_declared` | `ainize.json` on the branch does not name this agent. | Merge step 1 first. |
| 422 `no_gates` | No `checks` in the repository and no `gates` in the request. | Add checks. |
| The dependency install fails with "Missing … from lock file" | The repository carries two lockfiles and the stale one was used. | Name the manager in `package.json` `packageManager`, or remove the stale lockfile. |
| A fix keeps going back to coding with "실행 증거를 확인하지 못했습니다" | `runEvidence` is on and the app cannot start in the sandbox. | Register with `runEvidence: false`. |

Remove an agent with `DELETE /api/qa-agents/<id>` (its owner, or an organization admin).

## See also

- [Use Ainize from Claude Code](./claude-code-skill.md)
- [Build an agent for AIN Teams](./build-for-ainteams.md)
- [ainize.json reference](./deploy-with-ainize-json.md)
