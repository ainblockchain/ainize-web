---
title: Deploy a GitHub repository
summary: Paste a GitHub repository's address on ainize and it is deployed — an AinDrive repository is created in your organization's drive, the project appears, and every later merge on GitHub deploys again. No terminal.
---

# Deploy a GitHub repository

Your code is on GitHub and nothing of it is on ainize yet. Paste the repository's address and ainize does the rest:
it creates the AinDrive repository your organization deploys from, makes the project, runs the first deployment, and
from then on follows the GitHub branch. You do not install a CLI, and you do not push anything yourself.

If the repository already is a project on ainize and you only want it to follow GitHub, turn on
[Sync from GitHub](./aindrive-git.md#3-keep-github-as-the-place-people-push) in the project's Settings instead.

## What you need

- An ainize account that is a member of an **organization**. The repository is created in that organization's drive,
  and the project belongs to the organization.
- A **public** GitHub repository — or a private one whose GitHub owner your operator allowed for your organization.
- Something ainize can run. A Next.js app needs nothing more. Anything else needs an
  [`ainize.json`](./deploy-with-ainize-json.md): either already in the repository, or typed on the form in step 3.

## Steps

1. Open **Deployments** → **Deploy an app** (the page is `/projects/new`).
2. Paste the GitHub address into **Repository URL** — `https://github.com/<owner>/<repo>`, or just `<owner>/<repo>`.
   The form turns into an import: it now asks for the organization and the name of the AinDrive repository to create
   (the GitHub repository's name unless you change it). **Branch** is the GitHub branch to deploy, `main` by default.
3. If the repository has no `ainize.json` and is not a Next.js app, open **ainize.json** on the form and write one.
   For a service with a `Dockerfile` this is enough:

   ```json
   { "kind": "service", "port": 8080, "healthcheck": "/" }
   ```

4. Press **Import and deploy**.

The page then shows three steps and moves to the project by itself:

| Step | What is happening | How long |
|---|---|---|
| Import requested | ainize checked the repository on GitHub and recorded the request | at once |
| Create the AinDrive repository and push the GitHub branch | the sync creates `aindrive.ainetwork.ai/<org>/git/<name>` with the branch as its `main` | within about a minute |
| The project appears and its first deployment starts | AinDrive binds the pushed repository to a new project, and that push deploys | seconds after the push |

When the project page opens, the first deployment is building; its log is on the page.

## Where `ainize.json` ends up

| The GitHub branch | What is deployed with |
|---|---|
| has `ainize.json` (at its root, or in first-level folders of a monorepo) | that file. What you typed on the form is ignored. |
| is a public Next.js app without the file | `{ "kind": "nextjs" }`, added for you |
| has no file and you typed one | what you typed |

In the last two cases the file is committed **on AinDrive only**, on top of the GitHub history; your GitHub repository
is never written to. To change it later, commit it on the AinDrive remote
([how](./aindrive-git.md#2-tell-git-about-it)) — or move it into the GitHub repository for good, but then remove the
AinDrive copy in the same step: the same file added on both sides is a merge conflict at the next sync.

A private repository cannot be looked at before the import, so a missing file is found by the sync: the page then says
*has no ainize.json — import it again with one*, and **Fix and import again** brings the form back.

## After the import

The project now follows the GitHub branch, exactly as if you had turned on **Sync from GitHub** yourself:

- A merge on GitHub reaches AinDrive and deploys within about ten minutes. **Sync from GitHub now** on the project
  page does it within a minute.
- Settings → **Sync from GitHub** shows the last check and lets you change the branch or pause the sync.
- Secrets, domains, storage and everything else are set on the project as for any other
  ([ainize.json reference](./deploy-with-ainize-json.md), [CI/CD](./ci-cd.md)).

## When it does not go through

| The page says | Meaning | Do this |
|---|---|---|
| *The GitHub repository was not found, or it is private* | ainize reads GitHub without a credential; private repositories are read only from GitHub owners allowed for your organization | make the repository public, or ask your operator to allow its owner |
| *The GitHub repository has no ainize.json and is not a Next.js app* | nothing says how to run it | write the `ainize.json` on the form |
| *A repository of that name already is a project* | the AinDrive name is taken | use another name, or set that project's upstream in its Settings |
| *Only a member of that organization can import into it* | you are not an active member | ask an owner of the organization to add you |
| *The import failed: creating the AinDrive repository was refused: …* | AinDrive refused the push — most often its secret scan found a credential in the history | remove the secret from the GitHub history, then import again |

**Withdraw the import** drops a request that has not become a project. What was already pushed stays on AinDrive.

## The same over the API

Signed in (session cookie or API key), as a member of the organization:

```bash
curl -X POST https://ainize.ai/api/github-imports \
  -H 'content-type: application/json' \
  -d '{"repo": "my-org/my-app", "branch": "main", "org": "my-team", "name": "my-app",
       "manifest": {"kind": "service", "port": 8080}}'
```

`202` answers `{ import, status, project: null }`. Poll `GET /api/github-imports/my-team/my-app` until `project` is
set (`status.state` is `pending`, then `ok`, or `error` with the reason); `DELETE` on the same address withdraws it.
The [HTTP API reference](../reference/http-api.md) has every field and error code.
