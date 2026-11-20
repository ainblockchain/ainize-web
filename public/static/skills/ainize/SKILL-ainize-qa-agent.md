---
name: ainize-qa-agent
description: Create a QA agent for a GitHub repository on Ainize — an agent that sits in an AIN Teams channel, turns a posted request into a code fix, runs the repository's checks and opens a pull request for a named approver. Use when the user says "이 저장소의 QA agent를 만들어줘", "QA 채널 세팅해줘", or asks to connect a repository to a qa channel. Needs `.ainize_key` and one AIN SSO device-login approval by the user.
---

# Ainize: a QA agent for a repository

A QA agent is an Ainize hosted agent (`https://ainize.ai/agents/<id>`) imported into an AIN Teams workspace. People
post in its channel; it fixes the repository, validates the fix, opens a pull request, and waits for an approver.
You register it with the API. You never edit ainize-node or files on the node host.

Read the installed [Ainize skill](./SKILL.md) first for the key and the organization. Work in a scratch directory (the steps leave
`sso.cookie`, `*.session.json` and `last.json` there, all private); download the helper next to them:

```bash
curl -fsSLO https://ainize.ai/static/skills/ainize/ain_session.py
```

Apply the [QA agent standard](https://ainize.ai/docs/how-to/qa-agent) when registering and testing the agent. Have the model read the original report, call scoped tools and compose its own reply. The QA thread has exactly two permitted reply events: receipt and verified completion. A job waiting for approval, project binding or deployment produces no thread update. Show its pending state on the board. Require the serving commit and a replay of the original symptom before completion. Route intermediate errors to `#monitoring-agents`. Replay previously failed reports after recovery.

## 0. Check the preconditions, and stop if one is missing

| What | How to check | If it is missing |
|---|---|---|
| The organization is admitted to QA | `curl -s https://ainize.ai/api/orgs/$ORG/qa/access -H "Authorization: Bearer $KEY"` → `allowed: true`, `available: true` | Stop. Ask the user to have the node operator admit it (`PUT /api/orgs/<org>/qa/access`). QA runs the repository's code on the node and opens pull requests with the node's GitHub account, so this is the operator's call. |
| The node's QA GitHub account can write to the repository | registration answers `repository_unreadable` when it cannot | Ask the user to add that account to the repository with write access. |
| The production domain is bound to the intended Ainize project | Open [Runs](https://ainize.ai/runs), select the project and verify the production domain and designated deployer. | QA registration and PR review can proceed. Keep production deployment pending until the operator connects the project that serves the domain. |
| A push to the branch does something irreversible (publishes to a store, runs a migration) | read the repository's CI files | Register with `"autoMerge": false` and tell the user: an approved fix stays an open pull request. |

## 1. Declare the agent in the repository

The repository must name its agent and list the checks a fix has to pass. Add to `ainize.json` on the QA branch
(create the file if the repository has none) and merge it:

```json
{
  "qa": { "agent": "myapp-qa" },
  "checks": [
    { "name": "type-check", "command": ["npm", "run", "type-check"] },
    { "name": "test", "command": ["npm", "test"] }
  ]
}
```

- The id ends in `-qa`, lower-case letters, digits and dashes.
- `command` is an argv, run from the repository root in a container with the dependencies installed and **no
  network**. Use `["sh", "-c", "…"]` for a pipeline. In a workspace monorepo, build the internal packages the
  check imports first (`yarn workspace @scope/shared build && yarn type-check`).
- Take the commands from the repository's own scripts and run them locally once. A check that already fails on the
  branch is not counted against a fix, but a check that cannot run at all protects nothing.
- A repository with two lockfiles is installed with the manager its `package.json` names in `packageManager`.

## 2. Sign in once

AIN Teams and Ainmem take a person's session, not the API key. Ask the user to approve one device login:

```bash
curl -fsSLO https://auth.comcom.ai/login.sh
bash login.sh --label "ainize qa agent setup" --out sso.cookie      # prints a https://auth.comcom.ai/device?code=… link
```

Give the user the link, wait for the approval, then:

```bash
python3 ain_session.py login teams
python3 ain_session.py login ainmem
```

Everything you do with these sessions happens **as that person**. Do only what this file lists.

## 3. AIN Teams: the channel

```bash
python3 ain_session.py call teams POST /api/channels '{"workspaceId":"<workspace uuid>","name":"qa-myapp","description":"myapp 수정 요청"}'
```

The workspace uuid is in any channel link (`/workspace/<uuid>/…`). Keep `id` and `shortId` from the answer. The
approver's Teams user id is `createdBy` here when the approver is the person signed in; for someone else use
`GET /api/workspaces/<uuid>/members`.

## 4. Ainmem: the board

Each request becomes a card on a board. Create a page, then the board on it:

```bash
python3 ain_session.py call ainmem GET /api/workspaces                      # pick the organization's workspace id
python3 ain_session.py call ainmem POST /api/pages '{"title":"qa-myapp 칸반보드"}'
python3 ain_session.py call ainmem POST /api/pages/<page id>/databases '{"title":"qa-myapp","properties":[{"name":"진행 상태","type":"status","options":["queued","coding","validating","blocked","completed"]},{"name":"요청 링크","type":"url"}],"views":[{"type":"table","name":"목록"},{"type":"board","name":"보드"}]}'
```

Put `table` first; a `board` as the first view adds a second status property. From the answer keep the database id,
the ids of the `title`, `status` and `url` properties, and the **ids** (not names) of the five status options.

## 5. Register the agent

```bash
curl -s -X POST https://ainize.ai/api/qa-agents -H "Authorization: Bearer $KEY" -H 'content-type: application/json' -d @register.json
```

```json
{
  "id": "myapp-qa", "orgId": "<org slug>", "name": "Myapp QA",
  "repository": "owner/name", "branch": "main",
  "teams":  { "origin": "https://ainteams.ainetwork.ai", "workspaceId": "<uuid>", "channelId": "<channel id>", "channelShortId": "<shortId>" },
  "ainmem": { "origin": "https://ainmem.ainetwork.ai", "workspaceId": "<uuid>", "databaseId": "<uuid>",
              "titlePropertyId": "<uuid>", "statusPropertyId": "<uuid>", "requestLinkPropertyId": "<uuid>",
              "statusOptions": { "queued": "<id>", "coding": "<id>", "validating": "<id>", "waiting": "<blocked id>", "completed": "<id>", "failed": "<blocked id>" } },
  "sso": { "issuer": "https://auth.comcom.ai", "orgId": "<AIN SSO org id, org_…>" },
  "approvers": [ { "subject": "<approver's AIN SSO account id>", "teamsUserId": "<uuid>", "name": "<display name>" } ],
  "autoMerge": true
}
```

- The signed-in person's SSO account id: `curl -s -b "$(cat sso.cookie)" https://auth.comcom.ai/api/session` →
  `account.id`. The SSO org id is `sso_org_ids` of the organization in `GET https://ainize.ai/api/orgs`.
- Omit `gates`: the node reads the `checks` you merged in step 1 and answers with them. Compare.
- Optional `limits` (`memory` up to `16g`, `timeoutMs` up to 1800000, `cpus` up to 16, `workspaceMiB`,
  `pidsLimit` up to 1024) when a check needs more than the defaults (4g, 5 minutes, 2 CPUs).
- 201 means the hosted agent exists; `state` is `needs_tokens`. On an error read `error.code`:
  `qa_not_enabled`, `repository_unreadable`, `repository_not_declared`, `no_gates`, `id_taken`, `channel_taken`.

## 6. Give the agent its two identities

```bash
# AIN Teams: import the agent (the answer carries its access token once), keep it mentions-only, add it to the channel
python3 ain_session.py call teams POST /api/agents '{"ainizeAgentId":"myapp-qa","workspaceId":"<uuid>","engagementLevel":0}'
python3 ain_session.py call teams POST /api/channels/<channel id>/members '{"userId":"<agent id from the answer>"}'

# Ainmem: a credential for the board (the answer carries its token once)
python3 ain_session.py call ainmem POST /api/qa/agents '{"databaseId":"<uuid>","agentId":"myapp-qa"}'
```

Each answer is in `last.json`; read `accessToken` / `token` from it and send it on without printing it:

```bash
curl -s -X PUT https://ainize.ai/api/qa-agents/myapp-qa/tokens/teams  -H "Authorization: Bearer $KEY" -H 'content-type: application/json' -d "{\"value\":\"$TEAMS_TOKEN\"}"
curl -s -X PUT https://ainize.ai/api/qa-agents/myapp-qa/tokens/ainmem -H "Authorization: Bearer $KEY" -H 'content-type: application/json' -d "{\"value\":\"$AINMEM_TOKEN\"}"
```

After the second one `state` is `pending_restart`. If the Teams import answers without `accessToken` (the agent was
already a member), issue a new one: `POST /api/agents/<agent id>/token {"workspaceId":"<uuid>"}`.

## 7. Wait for it to go live, then prove it

The node reads QA settings when it starts. The agent serves its channel from the next node start after both tokens
are set — the next release, usually within the day. Do not ask anyone to restart the node for this.

```bash
curl -s https://ainize.ai/api/qa-agents/myapp-qa -H "Authorization: Bearer $KEY"     # state: active
```

When it is `active`, use a small human-authored report in a test channel and verify its receipt. Follow the job on the board through checks and the named approver's decision. After merge, the designated deployer opens [Runs](https://ainize.ai/runs), selects the project serving the production domain, enters the reviewed 40-character main commit SHA and starts the production deployment. If a Run already exists for this release, open it and record its ID. If the deployment control is missing, check the project binding and deployer access. See the [illustrated Run guide](https://ainize.ai/docs/how-to/deploy-with-ainize-json) for the controls and error log.

Verify the Run succeeded, the production health endpoint reports a healthy service, the serving commit matches the target, and the originally reported action passes there. Then verify the completion reply. Keep failed Runs linked to their retries and send intermediate errors to `#monitoring-agents`.


## What to tell the user at the end

- The channel, the board, the agent's page (`https://ainize.ai/agents/<id>`), who approves, and whether an approved
  fix merges by itself (`autoMerge`).
- That the Ainmem credential currently works only for the organization Ainmem is configured for; another
  organization needs that changed on Ainmem first. If step 6 answers 403 for this reason, say so and stop.
- Removing it: `DELETE https://ainize.ai/api/qa-agents/<id>` by the agent's owner or an organization admin.
