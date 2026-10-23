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

The push creates the repository in your organization's AinDrive, and because the repository has `ainize.json`, Ainize builds and deploys it. Keep `package-lock.json` committed and keep `node_modules`, `.next` and secrets out of the repository.

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
