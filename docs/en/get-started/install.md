---
summary: AinCode at ainize.ai/code is a workspace with the CLI, Git and AinDrive already set up — nothing to install.
---

# Open AinCode

[AinCode](/code) is the coding workspace on ainize.ai. Sign in with your Ainize account and it opens with Node.js,
Python, Git and the `ainize` CLI installed, and with Git already reaching your organization's AinDrive. There is
nothing to install.

Under every runnable block on these pages, **Run this in AinCode** opens the workspace with that block's commands
already in the input box, in shell mode. Press Enter and they run.

## Check the tools

```bash
node --version
ainize --version
ainize --help
```

## What the workspace has

| | |
|---|---|
| `$AINDRIVE_ORG`, `$AINDRIVE_USER` | Your organization's AinDrive and your name. The commands in these pages use them, so the repositories they create are yours. |
| Git | `https://aindrive.ainetwork.ai/<org>/git/<repo>` clones and pushes with your own AinDrive permission, without a token. A push to a new name creates the repository. |
| `$AINIZE_API` | The Ainize API, signed in as you: projects, deployments and their logs. |
| `ainize` | The CLI, for calling agents and models. |
| `curl`, `jq` | For reading the API. |

The workspace agent uses Qwen3.8-Flash-Next by default. To use GLM-5.3-Flash, choose it in the model selector
(`/models` in the terminal UI).

To run a node on your own machine instead, see [Install the CLI on your machine](../node/install.md).

Next: [Quickstart](./quickstart.md).
