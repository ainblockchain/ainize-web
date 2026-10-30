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

- A merge on GitHub reaches AinDrive within minutes (the sync backs off per repository when nothing changes).
- On the project page, **Sync from GitHub now** asks for an immediate run; it starts within a minute
  (`POST /api/projects/{id}/github-sync`, owner or org member).
- **A GitHub merge alone never deploys.** Deployment is the AinDrive push the sync makes — so if the sync is paused or
  the repository is not in it, push AinDrive `main` yourself with the credential above.
- Which repositories are synced is the operator's list (the sync job runs with an operator token); ask them to add a
  repository.

Files that only make sense on AinDrive — `ainize.json`, `Dockerfile.ainize`, mocks for a peer that cannot reach the
real service — live in AinDrive-only commits that the sync keeps on top of the GitHub history. To change one, commit
it on the AinDrive remote directly (section 2); do not add it on GitHub, or the next sync meets an add/add conflict.

## What you never need

- A shell or SSH login on the AinDrive host. Git over HTTPS is the whole interface, as with GitHub.
- Someone else's session. Each person (or agent) signs in once; the token is theirs and the push is recorded as theirs.
- A server-side "deploy" step. `ainize.json` + push = deployment; `GET /api/projects/{id}/deployments` shows it.
