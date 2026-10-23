---
title: Next.js 앱 배포하고 Teams에서 공유하기
summary: Next.js 저장소를 AIN Drive에 push하고 Ainize 배포를 확인한 뒤 AIN Teams에서 AIN-UI 카드로 공유합니다.
source: en/how-to/deploy-nextjs.md
source_sha256: a8f5a43530b1e2c43bdc393fc60c9b8088e7c8152a75866ced10b01bea99e487
---

# Next.js 앱 배포하고 Teams에서 공유하기

상단 **앱(Apps)** 메뉴에서 Git 저장소를 연결하거나 팀 앱을 살펴보고 Next.js 예제를 열 수 있습니다. 앱은 웹앱과 API 서비스를 포함하며 Next.js는 지원하는 프레임워크 중 하나입니다.

## 예제로 시작하기

[Next.js Hello World 저장소](https://aindrive.ainetwork.ai/comcom/git/nextjs-hello-world)에는 페이지 하나, 클릭 카운터, `/api/health`가 있습니다. 이것을 내 저장소로 복사해 push 합니다. 아래 코드는 모두 [AinCode](../get-started/install.md)에서 그대로 실행됩니다.

```bash
git clone https://aindrive.ainetwork.ai/comcom/git/nextjs-hello-world ~/projects/$AINDRIVE_USER-nextjs
cd ~/projects/$AINDRIVE_USER-nextjs
git remote set-url origin https://aindrive.ainetwork.ai/$AINDRIVE_ORG/git/$AINDRIVE_USER-nextjs
git push -u origin main
```

push가 우리 조직 AinDrive에 저장소를 만들고, 저장소에 `ainize.json`이 있으므로 Ainize가 빌드해 배포합니다. `package-lock.json`은 커밋하고, `node_modules`, `.next`, 비밀 값은 저장소에 넣지 마세요.

## 앱 설정하기

저장소 루트에 `ainize.json`을 추가합니다.

```json
{
  "kind": "nextjs",
  "name": "Next.js Hello World",
  "port": 3000,
  "healthcheck": "/api/health"
}
```

예제의 Dockerfile은 잠금 파일의 의존성을 설치하고 앱을 빌드한 뒤 `0.0.0.0:3000`에서 시작합니다. 직접 작성한 Dockerfile이 기본 Next.js 빌드보다 우선합니다. 다른 프로젝트 유형은 [배포 설정](./deploy-with-ainize-json.md)을 참고하세요.

배포된 앱은 `/svc/<projectId>/` 아래에서 제공됩니다. 예제는 `assetPrefix: './'`와 상대 링크를 사용해 JavaScript와 상태 확인 링크가 이 경로 안에서 열리게 합니다. 규모가 큰 앱에서는 하위 페이지, 리소스 URL, API 호출도 배포 경로에서 확인하세요. 첫 페이지가 응답하는 것만으로 모든 기능이 동작한다고 볼 수는 없습니다.

예제는 Next.js middleware에서 요청마다 CSP nonce를 추가하고 페이지를 동적으로 렌더링합니다. 임의의 인라인 스크립트를 허용하지 않으면서 Next.js 클라이언트 컴포넌트를 초기화하기 위한 설정입니다. 예제를 복사할 때 이 middleware도 유지하세요.

## 배포 확인

Next.js 빌드는 1~2분 걸립니다. `status`가 `ready`가 될 때까지 실행하세요.

```bash
P=$(curl -s "$AINIZE_API/projects/by-repo?repo=https://aindrive.ainetwork.ai/$AINDRIVE_ORG/git/$AINDRIVE_USER-nextjs&branch=main")
echo "$P" | jq '{name, status, page: .url, app: .lastDeployment.outputUrl}'
curl -s "$AINIZE_NODE_URL/svc/$(echo "$P" | jq -r .id)/api/health"
```

`app`이 배포된 앱의 주소입니다. 열어서 카운터가 올라가는지 확인하세요. 마지막 줄은 실행 중인 앱의 `/api/health`를 물어보며 `{"ok":true,…}`로 답합니다. 배포가 실패하면 프로젝트 `page`에서 빌드 로그를 읽고, 소스나 `ainize.json`을 고쳐 커밋하고 다시 push 하세요.

## 앱 주소 설정

공개 Ainize에서 웹 앱을 배포하면 `ainetwork.xyz` 아래의 주소가 자동 할당됩니다. 예제의 주소는 `https://nextjs-hello.ainetwork.xyz`입니다. 다른 앱이 이미 사용하는 이름에는 짧은 구분자가 붙습니다.

프로젝트의 **설정 → 도메인**에서 기본 주소를 변경할 수 있습니다. 자신의 도메인을 추가하려면 화면에 표시되는 A 또는 CNAME 레코드와 소유권 확인용 TXT 레코드를 DNS 관리 서비스에 등록한 뒤 **설정 확인**을 누르세요. DNS가 확인되면 Ainize가 HTTPS 인증서를 자동으로 발급합니다. Cloudflare에서는 이 설정에 DNS 전용 모드를 사용하세요.

기본 주소를 변경하면 기존 주소가 해제되므로 공유한 링크와 즐겨찾기도 새 주소로 바꾸세요. 저장소와 프로젝트 관리 페이지 주소는 계속 사용할 수 있습니다.

## AIN Teams에서 저장소 공유하기

AIN Teams 메시지에 저장소 URL을 붙여 넣습니다.

```text
https://aindrive.ainetwork.ai/comcom/git/nextjs-hello-world
```

저장소 미리보기는 연결된 Ainize 프로젝트의 AIN-UI 카드를 제공합니다. 소스와 배포 상태를 확인하고 준비가 끝나면 배포된 앱 링크를 여세요. 계속 실행되는 Next.js 앱은 웹앱으로 열고, 스크립트는 Run 흐름을 사용합니다. 에이전트 채팅 UI를 제공하려면 [AIN Teams용 에이전트 만들기](./build-for-ainteams.md)를 참고하세요.
