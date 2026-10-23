---
summary: Write code in AinCode, push it to AinDrive, and Ainize deploys it — a script first, then an agent.
---

# Quickstart: from code to deployment

On Ainize a `git push` is a deployment. A repository in your organization's AinDrive with an `ainize.json` at its
root is built and run on every push. This page deploys a small script, changes it, and then deploys an agent.

Every block below runs as written in [AinCode](./install.md). Press **Run this in AinCode** under a block: the
workspace opens with the commands in the input box, and Enter runs them. The repositories are named after you
(`$AINDRIVE_USER`) in your organization's AinDrive (`$AINDRIVE_ORG`), so nothing needs filling in.

## 1. Create a repository

```bash
mkdir -p ~/projects/$AINDRIVE_USER-hello
cd ~/projects/$AINDRIVE_USER-hello
git init -b main
git remote add origin https://aindrive.ainetwork.ai/$AINDRIVE_ORG/git/$AINDRIVE_USER-hello
```

The repository does not exist in AinDrive yet. Your first push creates it.

## 2. Write the code and ainize.json

```bash
cd ~/projects/$AINDRIVE_USER-hello
cat > hello.py <<'EOF'
import platform

print("Hello from Ainize")
print("Python", platform.python_version())
EOF
cat > ainize.json <<'EOF'
{ "kind": "script", "entry": "hello.py" }
EOF
```

`"kind": "script"` runs `hello.py` once on every push and keeps what it prints as the deployment log.
[ainize.json](../how-to/deploy-with-ainize-json.md) describes the other kinds: a Next.js app, a service, an agent.

## 3. Push: that is the deployment

```bash
cd ~/projects/$AINDRIVE_USER-hello
git add .
git commit -m "Hello from Ainize"
git push -u origin main
```

AinDrive sees `ainize.json` in the pushed commit and Ainize creates the project and deploys it. There is no
separate deploy step.

## 4. See it deployed

```bash
P=$(curl -s "$AINIZE_API/projects/by-repo?repo=https://aindrive.ainetwork.ai/$AINDRIVE_ORG/git/$AINDRIVE_USER-hello&branch=main")
echo "$P" | jq '{name, status, page: .url}'
curl -s "$AINIZE_API/deployments/$(echo "$P" | jq -r .lastDeploymentId)/log"
```

`status` goes `building` → `ready` within seconds; run the block again if it is not `ready` yet. The log ends with
what `hello.py` printed. `page` is the project page on ainize.ai, with every deployment and its log.

## 5. Change it and push again

```bash
cd ~/projects/$AINDRIVE_USER-hello
sed -i 's/Hello from Ainize/Hello again from Ainize/' hello.py
git commit -am "Say hello again"
git push
```

Run step 4 again: a new deployment, and its log says *Hello again*.

## 6. Deploy an agent

An agent is a repository too. This one is a prompt and a model, so there is no code to write:

```bash
mkdir -p ~/projects/$AINDRIVE_USER-agent
cd ~/projects/$AINDRIVE_USER-agent
git init -b main
git remote add origin https://aindrive.ainetwork.ai/$AINDRIVE_ORG/git/$AINDRIVE_USER-agent
cat > ainize.json <<'EOF'
{
  "kind": "agent",
  "agent": {
    "name": "Hello agent",
    "description": "Answers in one friendly sentence.",
    "model": "GLM-5.3-Flash"
  }
}
EOF
cat > prompt.md <<'EOF'
You are a friendly greeter. Answer in one short sentence.
EOF
git add .
git commit -m "Hello agent"
git push -u origin main
```

## 7. Call the agent

```bash
P=$(curl -s "$AINIZE_API/projects/by-repo?repo=https://aindrive.ainetwork.ai/$AINDRIVE_ORG/git/$AINDRIVE_USER-agent&branch=main")
echo "$P" | jq '{name, status, agent: .lastDeployment.outputUrl}'
AGENT=$(echo "$P" | jq -r '.lastDeployment.outputUrl | split("/") | last')
ainize agent call "$AGENT" "Hello, who are you?"
```

`agent` is its A2A address. The agent is shared with your organization, so it also appears in
[AIN Teams](https://ainteams.ainetwork.ai) under **Invite agent**. Change `prompt.md`, push, and the next call
answers with the new prompt.

## Next

- [Deploy a Next.js app](../how-to/deploy-nextjs.md): a web app with its own address.
- [ainize.json](../how-to/deploy-with-ainize-json.md): every key and kind.
- [Build an agent for AIN Teams](../how-to/build-for-ainteams.md): an agent with code of its own.
- Running a node of your own is separate: [Start a local node](../node/quickstart.md).
