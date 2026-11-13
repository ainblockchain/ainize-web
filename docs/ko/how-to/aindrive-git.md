---
title: 어느 머신에서나 AinDrive를 git 리모트로 쓰기
summary: AinDrive는 GitHub와 같은 git 호스트입니다. 노트북이나 CI에서 토큰으로 HTTPS clone·push 하고, GitHub는 사람들이 push 하는 곳으로 두고 동기화로 머지를 가져오며, 배포를 위해 서버에 로그인하지 않습니다.
source: en/how-to/aindrive-git.md
source_sha256: 1fefe6248e9aa9971c79399bfbe0903b08572823c268fecd25968c8ccef2df00
---

# 어느 머신에서나 AinDrive를 git 리모트로 쓰기

우리 조직의 AinDrive는 git 호스트입니다. 모든 저장소에 리모트 URL이 있고, push 에는 자격증명 하나만 필요하며, 루트에
`ainize.json` 이 있는 저장소로의 push 는 곧 배포입니다. AinDrive 서버에 셸을 열어 작업할 일은 없습니다 — GitHub 에 push
하려고 GitHub 서버에 로그인하지 않는 것과 같습니다.

| | GitHub | AinDrive |
|---|---|---|
| 리모트 | `https://github.com/<owner>/<repo>` | `https://aindrive.ainetwork.ai/<org>/git/<repo>` |
| 자격증명 | personal access token, `gh auth login` | `aindrive login` 의 로그인 토큰, 또는 계정 OAuth 토큰 |
| 저장소 페이지 | `github.com/<owner>/<repo>` | `aindrive.ainetwork.ai/<org>/git/<repo>` (tree·blob·commits·deployments) |
| 저장소 만들기 | New repository | 아직 없는 이름으로 push |
| 배포 | Actions | 저장소의 `ainize.json`; push 마다 배포([레퍼런스](deploy-with-ainize-json.md)) |

[AinCode](/code) 안에서는 이 모든 것이 이미 준비되어 있습니다 — Git 이 내 권한으로 조직의 AinDrive 에 닿습니다. 이 문서는
그 밖의 모든 곳, 즉 내 머신·CI 러너·내가 직접 돌리는 에이전트를 위한 것입니다.

## 짧은 길: `ainize login` 다음 `ainize deploy`

내 컴퓨터에서 앱을 배포할 때는 aindrive CLI도, git credential helper도 필요 없습니다. 승인은 `ainize login` 한 번뿐입니다. 브라우저에서 Ainize에 한 번 로그인하면, 배포할 때마다 노드가 내 계정의 15분짜리 AinDrive git 자격증명을 CLI에 건네줍니다. 그리고 `ainize deploy`가 현재 저장소에 커밋된 내용을 push한 뒤 빌드를 끝까지 따라갑니다.

```bash
npm install -g ainize
ainize login
cd my-app                 # 루트에 ainize.json이 있고 커밋이 하나 이상 있는 git 저장소
ainize deploy --org <org> --repo <name>
```

`ainize deploy`는 저장소를 git 리모트 `ainize`로 기억하므로 다음부터는 옵션 없이 `ainize deploy`만 실행하면 되고, `origin`은 건드리지 않습니다. 조직이 하나뿐이면 `--org`를 생략할 수 있고 `--repo`의 기본값은 디렉터리 이름입니다. 명령은 프로젝트 페이지를 출력하고, 배포가 `ready`가 되면 앱 주소도 출력합니다. 로그인 정보는 그 한 번의 push에만 git에 전달되며, 리모트 URL이나 git 설정에는 아무것도 기록되지 않습니다. CI에서는 `ainize deploy --no-wait --json`을 쓰세요.

이 페이지의 나머지는 AinDrive를 일반 git 리모트로 쓰는 방법입니다. clone, 다른 브랜치 push, `ainize` CLI 없는 CI가 여기에 해당합니다.

## 1. 자격증명 얻기

**CLI 로 한 번 로그인합니다.** 승인 페이지가 열리고, 승인하면 이 서버의 세션 토큰(30일)이
`~/.aindrive/credentials.json` 에 저장됩니다:

```bash
npm i -g aindrive
aindrive login --server https://aindrive.ainetwork.ai
```

`aindrive login` 이 하는 일은 HTTP 로 보면 `POST /api/auth/cli/start` → 브라우저에서
`https://aindrive.ainetwork.ai/cli-login/<linkId>` 열기 → `{ token, user }` 가 올 때까지 `{ linkId, deviceSecret }` 로
`POST /api/auth/cli/poll` 입니다. CLI 가 없는 스크립트도 이 세 호출로 같은 일을 합니다.

**또는 계정 OAuth 토큰을 씁니다.** aindrive 로 사용자를 로그인시킨 애플리케이션("Sign in with aindrive", 스코프
`drives:write`)은 `aind_aat_…` 액세스 토큰과 `aind_art_…` 리프레시 토큰을 갖고 있고, 액세스 토큰으로 push 할 수 있습니다.
드라이브 MCP 토큰(`aind_pat_…`)은 한 드라이브의 MCP 도구에 고정되어 있어 git 에는 **쓸 수 없습니다**.

무엇을 쓰든 자격증명은 **나**로서 동작합니다. push 는 저장소 경로에서 *editor*, clone 은 *viewer* 역할이 필요하며, 드라이브의
파일 화면과 같은 역할입니다. 별도의 "git 권한"은 없습니다.

## 2. git 에 알려 주기

git 은 자격증명을 HTTP Basic 으로 보냅니다. 사용자 이름은 무시되고(`x-access-token` 을 쓰세요) 비밀번호가 토큰입니다:

```bash
# 토큰이 리모트 URL 과 셸 히스토리에 남지 않도록 credential helper 로
git config --global credential.https://aindrive.ainetwork.ai.username x-access-token
git config --global credential.https://aindrive.ainetwork.ai.helper \
  '!f() { echo "password=$(python3 -c "import json;print(json.load(open(\"$HOME/.aindrive/credentials.json\"))[\"sessionCookie\"])")"; }; f'

git clone https://aindrive.ainetwork.ai/comcom/git/ainspace
cd ainspace && git push origin main
```

CI 작업처럼 한 번만 쓸 때는 URL 에 토큰을 넣어도 됩니다:
`git push https://x-access-token:$AINDRIVE_TOKEN@aindrive.ainetwork.ai/comcom/git/ainspace main`. 이 토큰은 GitHub PAT
처럼 다루세요 — 30일짜리 내 로그인입니다.

SSH 는 운영자가 git SSH 포트를 열어 둔 곳에서 AIN SSO 계정에 등록한 SSH 키로 `git@aindrive.ainetwork.ai:<org>/<repo>`
가 동작합니다. HTTPS 는 항상 동작합니다.

## 3. GitHub 는 사람들이 push 하는 곳으로 두기

많은 팀이 저장소를 GitHub 에 두고(리뷰·Actions·이력) AinDrive 를 배포되는 사본으로 씁니다. **GitHub → AinDrive 동기화**가
그 일을 합니다. GitHub `main` 은 AinDrive `main` 으로(`ainize.json` 같은 AinDrive 전용 커밋 위에 머지되어), `develop` 은
`develop` 으로 미러되고, 배포는 다른 AinDrive push 뒤와 똑같이 이어집니다.

리포가 아직 GitHub 에만 있나요? [GitHub 리포 배포하기](./deploy-from-github.md)는 폼 하나로 AinDrive 저장소와 프로젝트를 만들고
이 동기화까지 켭니다. 아래는 이미 있는 프로젝트에 대한 내용입니다.

### 프로젝트에서 켜기

프로젝트 소유자나 조직 멤버라면 누구나 직접 켭니다. 운영자 요청이나 서버 로그인은 필요 없습니다.

1. ainize 에서 프로젝트를 열고 **설정** → **GitHub에서 동기화** 로 갑니다.
2. GitHub 리포(`owner/repo` 또는 `https://github.com/...` 주소)와 따라갈 브랜치(기본 `main`)를 넣고 **동기화 켜기**를 누릅니다.

API 로는 세션이나 API 키로 이렇게 합니다.

```bash
curl -X PUT https://ainize.ai/api/projects/<project-id>/github-sync \
  -H 'content-type: application/json' \
  -d '{"repo": "my-org/my-app", "branch": "main"}'
```

확인하는 것:

- **저장할 때:** GitHub 에 익명으로 리포를 묻습니다. 공개 리포라면 그 브랜치가 있어야 합니다. 비공개 리포는 그 GitHub 소유자가
  조직에 허용된 경우에만 받습니다(동기화는 비공개 리포를 자체 GitHub 권한으로 읽으므로 아무 리포나 받지 않습니다). 아니면
  `github_repo_not_found` 입니다. 한 AinDrive 리포의 프로젝트들(모노레포 폴더들)은 업스트림 하나를 함께 씁니다.
- **그 뒤 1분 안에:** 동기화가 직접 리포를 읽을 수 있는지, 브랜치가 있는지, 그 브랜치가 AinDrive `main` 에 깨끗하게
  머지되는지 확인합니다. AinDrive 가 그대로 미러이거나, AinDrive 전용 커밋이 충돌 없이 위에 얹혀 있어야 합니다. 결과는 페이지에
  나옵니다.

### 보이는 것

**GitHub에서 동기화** 카드(와 프로젝트 머리글의 한 줄)에 상태가 나옵니다. *동기화됨* 또는 *동기화 실패*와 그 이유(예: 충돌난
파일), 마지막 확인, 마지막으로 무언가 push 한 시각, AinDrive `main` 커밋과 그것이 온 GitHub 커밋, 다음 확인 시각입니다.
`GET /api/projects/{id}/github-sync` 는 같은 내용을 JSON 으로 돌려줍니다.

- GitHub 의 머지는 몇 분 안에 AinDrive 에 닿습니다(바뀐 게 없으면 저장소별로 간격을 늘립니다. 5분에서 두 배씩 2시간까지,
  바뀌면 처음으로).
- **GitHub에서 지금 동기화**를 누르면 바로 실행을 요청하고 1분 안에 시작합니다
  (`POST /api/projects/{id}/github-sync`, 소유자 또는 조직 멤버).
- **동기화 멈추기**(`DELETE /api/projects/{id}/github-sync`)는 다시 켤 때까지 그 리포의 동기화를 멈춥니다.
- **GitHub 머지만으로는 배포되지 않습니다.** 배포는 동기화가 하는 AinDrive push 입니다. 동기화가 멈췄거나 실패했다면 위의
  자격증명으로 AinDrive `main` 에 직접 push 하세요.

AinDrive 에서만 의미 있는 파일 — `ainize.json`, `Dockerfile.ainize`, 실제 서비스에 닿지 못하는 피어용 mock — 은 동기화가
GitHub 이력 위에 유지하는 AinDrive 전용 커밋에 있습니다. 바꿀 때는 AinDrive 리모트에 직접 커밋하세요(2절). GitHub 에 추가하면
다음 동기화에서 add/add 충돌이 납니다.

## 필요 없는 것

- AinDrive 호스트의 셸이나 SSH 로그인. GitHub 처럼 HTTPS git 이 인터페이스의 전부입니다.
- 다른 사람의 세션. 사람(또는 에이전트)마다 한 번 로그인하고, 토큰은 그 사람의 것이며 push 도 그 사람의 것으로 기록됩니다.
- 서버 쪽 "배포" 단계. `ainize.json` + push = 배포이고, `GET /api/projects/{id}/deployments` 에서 볼 수 있습니다.
