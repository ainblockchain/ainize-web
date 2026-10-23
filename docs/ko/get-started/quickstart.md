---
source: en/get-started/quickstart.md
source_sha256: 8376b2f8baaff4a30198a8cabeb810e4f00ea427f7e66a2bce17867fb0ae619a
summary: AinCode에서 코드를 쓰고 AinDrive에 push 하면 Ainize가 배포합니다. 스크립트 하나, 그리고 에이전트 하나.
---

# 빠른 시작: 코드에서 배포까지

Ainize에서는 `git push`가 곧 배포입니다. 우리 조직 AinDrive의 저장소 루트에 `ainize.json`이 있으면 push 할
때마다 빌드되고 실행됩니다. 이 페이지에서는 작은 스크립트를 배포하고, 고쳐서 다시 배포한 뒤, 에이전트를
배포합니다.

아래 코드는 모두 [AinCode](./install.md)에서 그대로 실행됩니다. 코드 아래의 **AinCode에서 이 코드 실행**을
누르면 명령이 입력창에 들어간 채 작업 공간이 열리고, Enter로 실행됩니다. 저장소 이름은 내 이름
(`$AINDRIVE_USER`)으로, 위치는 우리 조직의 AinDrive(`$AINDRIVE_ORG`)로 정해지므로 채울 값이 없습니다.

## 1. 저장소 만들기

```bash
mkdir -p ~/projects/$AINDRIVE_USER-hello
cd ~/projects/$AINDRIVE_USER-hello
git init -b main
git remote add origin https://aindrive.ainetwork.ai/$AINDRIVE_ORG/git/$AINDRIVE_USER-hello
```

AinDrive에는 아직 이 저장소가 없습니다. 첫 push가 만듭니다.

## 2. 코드와 ainize.json 작성

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

`"kind": "script"`는 push 할 때마다 `hello.py`를 한 번 실행하고, 출력한 내용을 배포 로그로 남깁니다.
다른 종류(Next.js 앱, 서비스, 에이전트)는 [ainize.json](../how-to/deploy-with-ainize-json.md)에 있습니다.

## 3. push: 이것이 배포입니다

```bash
cd ~/projects/$AINDRIVE_USER-hello
git add .
git commit -m "Hello from Ainize"
git push -u origin main
```

AinDrive가 push 된 커밋에서 `ainize.json`을 보고, Ainize가 프로젝트를 만들어 배포합니다. 따로 배포하는
단계는 없습니다.

## 4. 배포 확인

```bash
P=$(curl -s "$AINIZE_API/projects/by-repo?repo=https://aindrive.ainetwork.ai/$AINDRIVE_ORG/git/$AINDRIVE_USER-hello&branch=main")
echo "$P" | jq '{name, status, page: .url}'
curl -s "$AINIZE_API/deployments/$(echo "$P" | jq -r .lastDeploymentId)/log"
```

`status`는 몇 초 안에 `building` → `ready`가 됩니다. 아직 `ready`가 아니면 다시 실행하세요. 로그 끝에
`hello.py`가 출력한 내용이 있습니다. `page`는 ainize.ai의 프로젝트 페이지로, 모든 배포와 로그가 있습니다.

## 5. 고쳐서 다시 push

```bash
cd ~/projects/$AINDRIVE_USER-hello
sed -i 's/Hello from Ainize/Hello again from Ainize/' hello.py
git commit -am "Say hello again"
git push
```

4단계를 다시 실행하면 새 배포가 보이고, 로그에 *Hello again*이 찍혀 있습니다.

## 6. 에이전트 배포

에이전트도 저장소입니다. 이 에이전트는 프롬프트와 모델만으로 되어 있어 작성할 코드가 없습니다.

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
    "model": "Qwen3.8-Flash-Next"
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

## 7. 에이전트 호출

```bash
P=$(curl -s "$AINIZE_API/projects/by-repo?repo=https://aindrive.ainetwork.ai/$AINDRIVE_ORG/git/$AINDRIVE_USER-agent&branch=main")
echo "$P" | jq '{name, status, agent: .lastDeployment.outputUrl}'
AGENT=$(echo "$P" | jq -r '.lastDeployment.outputUrl | split("/") | last')
ainize agent call "$AGENT" "Hello, who are you?"
```

`agent`는 에이전트의 A2A 주소입니다. 이 에이전트는 우리 조직에 공유되므로 [AIN Teams](https://ainteams.ainetwork.ai)의
**Invite agent**에도 나타납니다. `prompt.md`를 고쳐 push 하면 다음 호출부터 새 프롬프트로 답합니다.

## 다음

- [Next.js 앱 배포하기](../how-to/deploy-nextjs.md): 자기 주소를 가진 웹 앱.
- [ainize.json](../how-to/deploy-with-ainize-json.md): 모든 키와 종류.
- [AIN Teams용 에이전트 만들기](../how-to/build-for-ainteams.md): 코드가 있는 에이전트.
- 내 노드를 돌리는 것은 별개입니다: [로컬 노드 시작하기](../node/quickstart.md).
