---
title: Use AinDrive as your git remote, from any machine
summary: AinDrive is a git host like GitHub — clone and push over HTTPS with a token from your laptop or CI, keep GitHub as the place people push and let the sync bring merges over, and never log in to a server to deploy.
---

# Use AinDrive as your git remote, from any machine

Your organization's AinDrive is a git host. Every repository has a remote URL, a push needs a credential and nothing
else, and a push to a repository whose root has `ainize.json` is a deployment. You never open a shell on the AinDrive
server to work with it — just as you never log in to GitHub's servers to push to GitHub.

| | GitHub | AinDrive |
|---|---|---|
| Remote | `https://github.com/<owner>/<repo>` | `https://aindrive.ainetwork.ai/<org>/git/<repo>` |
| Credential | personal access token, `gh auth login` | sign-in token from `aindrive login`, or an account OAuth token |
| Repo page | `github.com/<owner>/<repo>` | `aindrive.ainetwork.ai/<org>/git/<repo>` (tree, blob, commits, deployments) |
| Create a repo | New repository | push to a name that does not exist yet |
| Deploy | Actions | `ainize.json` in the repo; every push deploys ([reference](deploy-with-ainize-json.md)) |

Inside [AinCode](/code) all of this is already set up: Git reaches the organization's AinDrive as you. This page is
for everywhere else — your own machine, a CI runner, an agent you run yourself.

## The short way: `ainize login`, then `ainize deploy`

To deploy an app from your own machine you need neither the aindrive CLI nor a git credential helper. `ainize login` signs you in to Ainize and connects AinDrive in the same step; `ainize deploy` pushes what is committed in the current repository and follows the build:

```bash
npm install -g ainize
ainize login
cd my-app                 # a git repository with ainize.json at its root and at least one commit
ainize deploy --org <org> --repo <name>
```

`ainize deploy` remembers the repository as the git remote `ainize`, so later deploys are `ainize deploy` with no flags, and `origin` is left untouched. `--org` can be omitted when you belong to one organization, and `--repo` defaults to the directory name. The command prints the project page and, once the deployment is `ready`, the app address. The sign-in is passed to git for that one push only: nothing is written to the remote URL or to a git config. Use `ainize deploy --no-wait --json` in CI.

The rest of this page is for using AinDrive as a plain git remote — cloning, pushing other branches, CI without the `ainize` CLI.

## 1. Get a credential

**Sign in once with the CLI.** It opens a page where you approve the sign-in, then stores a session token for this
server (30 days) in `~/.aindrive/credentials.json`:

```bash
npm i -g aindrive
aindrive login --server https://aindrive.ainetwork.ai
```

`aindrive login` does, in HTTP terms, `POST /api/auth/cli/start` → open `https://aindrive.ainetwork.ai/cli-login/<linkId>`
in a browser → `POST /api/auth/cli/poll` with `{ linkId, deviceSecret }` until it answers `{ token, user }`. A script
without the CLI can do the same three calls.

**Or use an account OAuth token.** An application that signed the person in with aindrive ("Sign in with aindrive",
scope `drives:write`) holds an `aind_aat_…` access token and an `aind_art_…` refresh token; the access token pushes.
Drive MCP tokens (`aind_pat_…`) are pinned to one drive's MCP tools and do **not** open git.

Whatever you use, the credential acts as **you**: a push needs you to be an *editor* at the repository's path in the
drive, a clone a *viewer* — the same roles the drive's file views use. There is no separate "git permission".

## 2. Tell git about it

Git sends the credential as HTTP Basic. The username is ignored (use `x-access-token`), the password is the token:

```bash
# a credential helper so the token stays out of the remote URL and shell history
git config --global credential.https://aindrive.ainetwork.ai.username x-access-token
git config --global credential.https://aindrive.ainetwork.ai.helper \
  '!f() { echo "password=$(python3 -c "import json;print(json.load(open(\"$HOME/.aindrive/credentials.json\"))[\"sessionCookie\"])")"; }; f'

git clone https://aindrive.ainetwork.ai/comcom/git/ainspace
cd ainspace && git push origin main
```

For a one-off (a CI job) the token can go in the URL instead:
`git push https://x-access-token:$AINDRIVE_TOKEN@aindrive.ainetwork.ai/comcom/git/ainspace main`. Treat that token like
a GitHub PAT: it is a 30-day sign-in as you.

Over SSH, `git@aindrive.ainetwork.ai:<org>/<repo>` works with an SSH key registered in your AIN SSO account where the
operator has exposed the git SSH port; HTTPS always works.

## 3. Keep GitHub as the place people push

Many teams keep their repository on GitHub — reviews, Actions, history — and let AinDrive be the deployed copy.
The **GitHub → AinDrive sync** does that: `main` is mirrored to AinDrive `main` (merged on top of the AinDrive-only
commits such as `ainize.json`), `develop` to `develop`, and the deployment follows as it would after any AinDrive push.

### Turn it on for your project

The project's owner or any member of its organization sets it up — no operator, no server login:

1. Open the project on ainize → **Settings** → **Sync from GitHub**.
2. Enter the GitHub repository (`owner/repo` or its `https://github.com/...` URL) and the branch to follow
   (default `main`), then **Turn on sync**.

Or over the API, with your session or an API key:

```bash
curl -X PUT https://ainize.ai/api/projects/<project-id>/github-sync \
  -H 'content-type: application/json' \
  -d '{"repo": "my-org/my-app", "branch": "main"}'
```

What is checked:

- **When you save:** the repository is asked about on GitHub anonymously. A public repository must have the branch.
  A private one is accepted only if its GitHub owner is allowed for your organization (the sync reads private
  repositories with its own GitHub access, so it is not offered for arbitrary ones); otherwise you get
  `github_repo_not_found`. All projects of one AinDrive repository (folders of a monorepo) share one upstream.
- **Within a minute after:** the sync itself checks that it can read the repository, that the branch exists, and that
  the branch merges cleanly into AinDrive `main` — either AinDrive is a plain mirror, or its AinDrive-only commits sit
  on top without conflicts. The result shows on the page.

### What you see

The **Sync from GitHub** card (and a line in the project header) shows the status: *In sync* or *Sync failed* with the
reason (for example the conflicting files), the last check, the last time something was pushed, the AinDrive `main`
commit next to the GitHub commit it came from, and the next check. `GET /api/projects/{id}/github-sync` returns the
same as JSON.

- A merge on GitHub reaches AinDrive within minutes (the sync backs off per repository when nothing changes: 5
  minutes, doubling up to 2 hours, reset by any change).
- **Sync from GitHub now** asks for an immediate run; it starts within a minute
  (`POST /api/projects/{id}/github-sync`, owner or org member).
- **Pause sync** (`DELETE /api/projects/{id}/github-sync`) stops it for the repository until you turn it on again.
- **A GitHub merge alone never deploys.** Deployment is the AinDrive push the sync makes — so if the sync is paused or
  failed, push AinDrive `main` yourself with the credential above.

Files that only make sense on AinDrive — `ainize.json`, `Dockerfile.ainize`, mocks for a peer that cannot reach the
real service — live in AinDrive-only commits that the sync keeps on top of the GitHub history. To change one, commit
it on the AinDrive remote directly (section 2); do not add it on GitHub, or the next sync meets an add/add conflict.

## What you never need

- A shell or SSH login on the AinDrive host. Git over HTTPS is the whole interface, as with GitHub.
- Someone else's session. Each person (or agent) signs in once; the token is theirs and the push is recorded as theirs.
- A server-side "deploy" step. `ainize.json` + push = deployment; `GET /api/projects/{id}/deployments` shows it.
