---
name: ainize
description: Deploy a GitHub repository to Ainize and operate it (status, logs, secrets, redeploy) with an Ainize API key. Use when the user says "배포해줘", "deploy this", "ainize에 올려줘", asks for a deployment's status or logs, or wants a secret set on an Ainize project. For a QA agent ("qa agent 만들어줘") use SKILL-ainize-qa-agent.md, which builds on this file.
---

# Ainize: deploy and operate a project

Everything here is an HTTPS call to `https://ainize.ai` with an organization API key. Nothing needs a browser.

## Before anything else

1. **The key.** Read it from `.ainize_key` in the working directory (one line, `ainize-sk-…`). If the file is missing,
   stop and tell the user to create an **organization** key at ainize.ai → API keys and save it there with mode 600.
   Never print the key, never put it in a commit, and add `.ainize_key` to `.gitignore` if it is not ignored.
2. **The organization.** An Ainize organization is the AIN SSO organization of the same people
   (auth.comcom.ai). A new customer or team gets its organization created there first, by an SSO owner; a key cannot
   create one. Check which organization the key speaks for:

   ```bash
   KEY=$(cat .ainize_key)
   curl -s https://ainize.ai/api/projects -H "Authorization: Bearer $KEY" | head -c 300   # 401 = bad key
   ```

Use the organization's slug (`comcom`) wherever a call asks for `org`.

## "배포해줘" — deploy a GitHub repository

For an existing project, resolve it by organization and repository name first and read `GET /api/projects/{id}`. If it has `productionRelease`, follow **Production Runs** below. For a new import, confirm the organization and intended project.

What the repository needs:

- It is on GitHub: public, or private under a GitHub owner the operator allowed for the organization.
- It says how to run. A Next.js app needs nothing. Anything else needs `ainize.json` at its root, and for a service a
  `Dockerfile`:

  ```json
  { "kind": "service", "port": 8080, "healthcheck": "/healthz" }
  ```

  If the file is missing, write it (and the Dockerfile) in the repository and push before importing. The full
  reference is https://ainize.ai/docs/how-to/deploy-with-ainize-json.
- The image's Node.js is current. A deployment is **refused** when the built image runs a Node.js with known CVEs
  (the error names the minimum version). Verify the exact Node patch in the built image and scan runtime and CI images independently. Record the scanner database date, image digest and remaining findings.

Deploy with one call, then watch it:

```bash
KEY=$(cat .ainize_key); ORG=comcom; REPO=owner/name; NAME=${REPO#*/}

# 1. import: creates the AinDrive repository, the project, and the first deployment (202)
curl -s -X POST https://ainize.ai/api/github-imports -H "Authorization: Bearer $KEY" \
  -H 'content-type: application/json' -d "{\"repo\":\"$REPO\",\"org\":\"$ORG\"}"

# 2. poll until `project.id` appears (about a minute); status.state is pending → ok, or error with a message
curl -s https://ainize.ai/api/github-imports/$ORG/$NAME -H "Authorization: Bearer $KEY"

# 3. the newest deployment: status building → ready, or error with the reason in `error`
curl -s https://ainize.ai/api/projects/$PROJECT/deployments -H "Authorization: Bearer $KEY"
```

Report to the user: the project page (`https://ainize.ai/<org>/<name>`), the deployment status, and the address from
step 5 below. A project in an organization is **org-private**: its address answers a member after sign-in and
redirects everyone else to the login. Say so; do not report a 302 as a failure.

If the deployment ends in `error`, read the reason, fix it **in the GitHub repository**, push, and ask for a sync
instead of waiting for the periodic one (up to ten minutes):

```bash
curl -s -X POST https://ainize.ai/api/projects/$PROJECT/github-sync -H "Authorization: Bearer $KEY" \
  -H 'content-type: application/json' -d '{}'
```

For an ordinary push-deployed project, a synchronized merge triggers a deployment. On a Run-managed project a sync records the new source revision.

## Production Runs

For a status request, use GET only. From the directory containing the organization key, run `python3 <skill-directory>/production_run.py <org> <project> <run-id-or-full-sha>`. An exact Run ID identifies its folder project automatically. For SHA lookup in a folder project append `--project-id <project-id>`. The helper verifies the project, selects its host-release runs and reads the masked stage logs. If the helper is unavailable, use `GET /api/projects/{id}/runs`, select `executionBackend: host-release` and read `GET /api/deployments/{runId}/log` with `Accept: text/plain`. For a commit with multiple attempts, identify each attempt by its Run ID. Report the first failed stage, its exit code and recorded diagnostics, the previous failure ID and serving commit when available. State which fields are missing. Inspect the UI at https://ainize.ai/runs.

When explicitly asked to deploy and `productionRelease.canDeploy` is true, POST to `/api/projects/{id}/runs` with `{"target":"commit","sha":"<reviewed 40-character main SHA>","entry":"deploy/production"}`. Record the returned Run ID. On an error, inspect that Run before starting a new attempt. A change to secrets takes effect through the project's release procedure.

## Inspect a specific deployment or script run

For a status or log request, use GET requests only. Look up the project by organization and repository name. For a service, read `GET /api/projects/{projectId}/deployments`; for script run history, read `GET /api/projects/{projectId}/runs`. Select the requested SHA or ID. Read its build or run log with `GET /api/deployments/{id}/log`, using the organization key and `Accept: text/plain`. Report the SHA, ID, status, and the relevant sanitized error lines. Runtime logs describe the running service and are a separate endpoint. A ready record alone does not verify the commit at the production domain.

## Operate

```bash
# 4. find a project again by organization and repository name
curl -s "https://ainize.ai/api/projects/by-name?org=$ORG&repo=$NAME" -H "Authorization: Bearer $KEY"

# 5. its addresses (the managed one is <name>.ainetwork.xyz) and whether each is ready
curl -s https://ainize.ai/api/projects/$PROJECT/domains -H "Authorization: Bearer $KEY"

# 6. what the running service printed
curl -s "https://ainize.ai/api/projects/$PROJECT/runtime-logs?tail=100" -H "Authorization: Bearer $KEY"

# 7. secrets: write-only, delivered as environment variables on the next deployment
curl -s -X PUT https://ainize.ai/api/projects/$PROJECT/secrets/DATABASE_URL -H "Authorization: Bearer $KEY" \
  -H 'content-type: application/json' -d '{"value":"…"}'
curl -s https://ainize.ai/api/projects/$PROJECT/secrets -H "Authorization: Bearer $KEY"      # names only
```

Ask the user for a secret's value; never invent one and never echo it back. After setting secrets the app needs at
start, follow the production Run procedure if the project has `productionRelease`. For a push-deployed project, sync the intended commit.

## What this skill does not do

- Create an organization, or admit one to a feature (storage, QA): that is an SSO owner's and the node operator's
  decision.
- Delete a project. Say how (project page → Settings) and let the user do it.
- Databases and file storage for a project: see https://ainize.ai/docs/how-to/managed-storage.
