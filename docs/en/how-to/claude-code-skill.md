---
title: Use Ainize from Claude Code
summary: Put an organization API key in .ainize_key, add the ainize skill, and ask Claude Code to deploy a repository or create a QA agent for it. What the skill does, what it asks you for, and what it will not do.
aincode: false
---

# Use Ainize from Claude Code

You work in Claude Code and want to say "deploy this" or "make a QA agent for this repository" instead of clicking
through pages. The **ainize skill** is two instruction files and two helper scripts. With them and an API key, Claude
Code calls the same HTTP API the pages use.

## Set it up

1. **Make the key.** On ainize, open **API keys** and create a key **for your organization**. Save it in the
   directory you work in:

   ```bash
   printf '%s' 'ainize-sk-…' > .ainize_key && chmod 600 .ainize_key
   echo .ainize_key >> .gitignore
   ```

2. **Add the skill.** In the project (or in `~/.claude/skills/ainize/` for every project):

   ```bash
   mkdir -p .claude/skills/ainize && cd .claude/skills/ainize
   curl -fsSLO https://ainize.ai/static/skills/ainize/SKILL-ainize.md
   curl -fsSLO https://ainize.ai/static/skills/ainize/SKILL-ainize-qa-agent.md
   curl -fsSLO https://ainize.ai/static/skills/ainize/ain_session.py
   curl -fsSLO https://ainize.ai/static/skills/ainize/production_run.py
   mv SKILL-ainize.md SKILL.md
   ```

   `SKILL.md` covers deploying and operating a project. `SKILL-ainize-qa-agent.md` covers QA agents and is read when
   you ask for one.

Your organization has to exist first. An Ainize organization is the AIN SSO organization of the same people, created
at auth.comcom.ai by an SSO owner; a key cannot create one. See [organizations](./organizations.md).

## What you can ask for

| You say | What happens | What it needs from you |
|---|---|---|
| "배포해줘" / "deploy this repository" | The GitHub repository is imported: an AinDrive repository, a project and its first deployment are created, and subsequent synchronized merges deploy ordinary projects. A project configured for production Runs starts a Run for the reviewed SHA. Claude Code reports the project page, the deployment's status and the address. | The repository on GitHub. For anything but a Next.js app, an [`ainize.json`](./deploy-with-ainize-json.md) — Claude Code writes one if it is missing. |
| "배포 상태 알려줘", "로그 보여줘" | Reads the newest deployment and the running service's log. | — |
| "DATABASE_URL 시크릿 설정해줘" | Sets a project secret (write-only). | The value. It is never invented or echoed. |
| "이 repo에 대한 qa agent를 만들어줘" | Creates a [QA agent](./qa-agent.md): channel, board, agent, credentials. | One device-login approval in your browser, and an organization the operator admitted to QA. |

## Inspect a production Run

Ask Claude Code to find the first failed stage, exit code, previous failed Run and serving commit for a specific project and Run ID. Use an organization key with read access to that project. From the project root you can also run the read-only helper:

```bash
python3 .claude/skills/ainize/production_run.py comcom ainize-node run_827d79a36a0ba7a3
```

A Run ID selects the project that executed it, including a folder project in a shared repository. To look up a commit SHA in a folder project, append `--project-id <project ID>`.

A SHA with multiple attempts returns each Run separately. The [production CI/CD guide](./deploy-with-ainize-json.md) shows where to find the same records in the UI.

## What it will not do

- Create an organization, or admit one to QA or managed storage. Those are an SSO owner's and the node operator's
  decisions.
- Delete a project or an agent without being told to.
- Print or commit your key or any token.

## See also

- [Deploy a GitHub repository](./deploy-from-github.md) — the same import, by hand
- [A QA agent for your repository](./qa-agent.md)
- [CI/CD: how a push ships](./ci-cd.md)
