---
title: Deploy a Next.js app and share it in Teams
summary: Push a Next.js repository to AIN Drive, inspect its Ainize deployment, and share the repository as an AIN-UI card in AIN Teams.
---

# Deploy a Next.js app and share it in Teams

Open **Apps** in the top menu to connect a Git repository, browse your team's apps, or follow the Next.js example. Apps includes web apps and API services; Next.js is one supported framework.

## Start from the example

The [Next.js Hello World repository](https://aindrive.ainetwork.ai/comcom/git/nextjs-hello-world) contains a page, a client-side click counter, and `/api/health`. Copy it into a repository of your own and push it. Each block runs as written in [AinCode](../get-started/install.md):

```bash
git clone https://aindrive.ainetwork.ai/comcom/git/nextjs-hello-world ~/projects/$AINDRIVE_USER-nextjs
cd ~/projects/$AINDRIVE_USER-nextjs
git remote set-url origin https://aindrive.ainetwork.ai/$AINDRIVE_ORG/git/$AINDRIVE_USER-nextjs
git push -u origin main
```

The push creates the repository in your organization's AinDrive, and because the repository has `ainize.json`, Ainize builds and deploys it. Keep `package-lock.json` committed and keep `node_modules`, `.next` and secrets out of the repository. From your own machine, outside AinCode, run `ainize login` and then `ainize deploy` in the repository instead — see [the short way](./aindrive-git.md).

## Describe the app

At the repository root, include `ainize.json`:

```json
{
  "kind": "nextjs",
  "name": "Next.js Hello World",
  "port": 3000,
  "healthcheck": "/api/health"
}
```

The example's Dockerfile installs locked dependencies, builds the app, and starts it on `0.0.0.0:3000`. A custom Dockerfile takes precedence over the default Next.js build. See [deployment configuration](./deploy-with-ainize-json.md) for other project types.

The deployed app is served under `/svc/<projectId>/`. The example uses `assetPrefix: './'` and relative links so its JavaScript and health link resolve inside that path. For a larger app, check nested routes, asset URLs, and API calls under the deployment path as well; a successful homepage response alone does not prove those work.

The example also adds a per-request CSP nonce through Next.js middleware and renders the page dynamically. This lets Next.js initialize its client components without allowing arbitrary inline scripts. Preserve this middleware when copying the example.

## Watch it deploy

A Next.js build takes a minute or two. Run this until `status` is `ready`:

```bash
P=$(curl -s "$AINIZE_API/projects/by-repo?repo=https://aindrive.ainetwork.ai/$AINDRIVE_ORG/git/$AINDRIVE_USER-nextjs&branch=main")
echo "$P" | jq '{name, status, page: .url, app: .lastDeployment.outputUrl}'
curl -s "$AINIZE_NODE_URL/svc/$(echo "$P" | jq -r .id)/api/health"
```

`app` is the deployed app's address; open it and check that the counter increments. The last line asks the running app for `/api/health`, which answers `{"ok":true,…}`. If the deployment fails, read the build log on the project `page`, fix the source or `ainize.json`, commit and push again.

## Set your app address

On the hosted Ainize service, web apps automatically receive an address under `ainetwork.xyz`. The example uses `https://nextjs-hello.ainetwork.xyz`. A short suffix distinguishes names already used by another app.

Open the project's **Settings → Domains** to change the default address. You can also add your own domain. Copy the displayed A or CNAME record and ownership TXT record into your DNS provider, then select **Check configuration**. Once DNS is verified, Ainize provisions HTTPS automatically. Keep DNS-only mode enabled when using Cloudflare for this configuration.

Changing the default address retires the old address, so update bookmarks and links you have shared. The repository and project console URLs stay available.

## Share the repository in AIN Teams

Paste the repository URL into an AIN Teams message, for example:

```text
https://aindrive.ainetwork.ai/comcom/git/nextjs-hello-world
```

The repository preview connects to its Ainize project as an AIN-UI card. Check its source and deployment status, then use the deployed app link when ready. A continuously running Next.js app opens as a web app; scripts use the Run workflow instead. To expose an agent's interactive chat UI, follow [Build an agent for AIN Teams](./build-for-ainteams.md).

## Connect an existing GitHub app

1. Sign in with the AIN account for your team and select its organization in **Apps**. Connect the app's repository and choose the branch to deploy. Record the resulting Ainize project URL; other team members can use the same console.
2. For an AinDrive copy that follows GitHub, open **Settings → Sync from GitHub**, enter `owner/repository` and the source branch, then save. Private repositories also need the sync operator's GitHub account to have read access. Your own GitHub access does not grant that worker access.
3. Commit `ainize.json` and the lockfile. For `admin/` or another app inside a monorepo, configure its build root and shared files using [deployment configuration](./deploy-with-ainize-json.md). Put public build-time values in `build.args`, runtime settings in `env`, and credentials in the project's secret settings. Declare `requiredSecrets`, `requiredEnv` and `build.requiredArgs` where a missing value must stop deployment.
4. Merge into the configured source branch, then use **Sync from GitHub now** if needed. Check the sync result, its last/next check, and the GitHub, project source, latest build and serving commits. A queued request is not a successful sync; a successful sync is not yet a healthy deployment. Open the build log when they differ.
5. Open the deployed address as a signed-in user. Check the app's core data view, a permitted write, model response and uploaded file, as applicable. Save the project URL, serving commit, test time and result in the release record. Routine releases happen by commit and merge; developers do not need a shell on the deployment server.

## Call an on-premise model from Next.js

Choose an available model on [Models](/models) and inspect its serving node/provider before using its ID. Do not infer that a model is on-premise from its name. Use the Ainize model API rather than a private GPU address: the deployed app receives `AINIZE_URL` and `AINIZE_API_KEY` from the runtime. Keep these on the server. Set a non-secret `MODEL_ID` to the model you selected and add it to `requiredEnv` in `ainize.json`.

For example, put this helper in `lib/model.ts`. Call it from an app route that already checks the caller's session and usage limit; it does not replace your app's authentication.

```ts
import 'server-only';

export async function askModel(question: string): Promise<string> {
  const { AINIZE_URL, AINIZE_API_KEY, MODEL_ID } = process.env;
  if (!AINIZE_URL || !AINIZE_API_KEY || !MODEL_ID) {
    throw new Error('Model configuration is missing');
  }
  const response = await fetch(`${AINIZE_URL.replace(/\/$/, '')}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AINIZE_API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL_ID, messages: [{ role: 'user', content: question }] }),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Model request failed (${response.status})`);
  const result = await response.json();
  const answer = result.choices?.[0]?.message?.content;
  if (typeof answer !== 'string') throw new Error('Model returned no text answer');
  return answer;
}
```

This example is for a chat model. Image, audio and decision models use their own request shapes; copy the matching example from the model page. Never rename the key to `NEXT_PUBLIC_*` or return it to the browser. For local development, issue your own scoped key using [the model key guide](./call-the-model.md); do not copy a production runtime key.

## Move external data without losing service

Moving the app's code does not move Firebase, a database, uploaded files, authentication or background jobs. Keep a migration record in the repository, and register the current mapping and unresolved checks in the project's **Operations** tab. For each dependency record:

| Source | Target | Verification and owner |
| --- | --- | --- |
| Cloud project ID, database/collection or bucket, region | Ainize project and Store/AinDrive location | Responsible person, export time, record count and sample checksums |
| Login provider, callback URL and service identity | Intended account/org and new callback or service identity | Sign-in, permission denial and revocation results |
| Job, webhook or trigger and its caller | Run/project URL, schedule and timezone | Last successful run and remaining old endpoint calls |

Follow the [AIN Store design](../design/ain-data-platform.md) for document data whose authority is AIN Blockchain and whose bodies are in AinDrive. An approved design is not evidence that every SDK or trigger feature is deployed: confirm the target's implemented operations with a small test import first. A Postgres/Blob [managed store](./managed-storage.md) is a different storage option, not proof that a Firebase app has been converted to AIN Store. Record it as an explicit exception if your team's target is AIN Store/AinDrive.

1. Export documents, object bytes and required metadata with the source owner's access. Record source IDs, counts, byte sizes and checksums. Keep an immutable export and prove it can be restored into an isolated target before cutover.
2. Implement the application's data adapter for the target. Preserve document IDs, timestamps, references, query/index behavior and object content types. Replace Firebase-specific listeners, security rules and triggers deliberately; transferring JSON alone does not reproduce them. Map users and organization permissions, then test both allowed and denied operations.
3. Import into a separate test project/location, reconcile counts and sampled content, and run the authenticated app against it. Test pagination, writes, file downloads and job results. For a relational exception, the managed-store guide covers dump/import and release-time schema migrations.
4. Select a cutover time and rollback owner. Either briefly pause writes or track and replay every change after the export, including deletes. Compare again before switching the app's server configuration. If two copies accept writes, define which is authoritative and how replay is deduplicated; do not assume dual writes cannot diverge.
5. Switch, deploy, and repeat the same signed-in user flows. Record the serving commit, target location and timestamp. If rollback is needed after new writes, reconcile those writes before reverting the connection; reverting code alone can lose data.
6. Observe source access logs, billing metrics and scheduled jobs for an agreed period that includes the longest job interval. List any remaining consumers by owner and endpoint. Keep necessary source billing/resources active until residual calls are resolved and the rollback/restore check passes. Then record the source retirement separately from the app deployment.
