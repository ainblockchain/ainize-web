---
title: Next.js 앱 배포하고 Teams에서 공유하기
summary: Next.js 저장소를 AIN Drive에 push하고 Ainize 배포를 확인한 뒤 AIN Teams에서 AIN-UI 카드로 공유합니다.
source: en/how-to/deploy-nextjs.md
source_sha256: 75f015e7b5a53d9af2091a59e26144d6d59f7de2f8afb52783109c156c3acba3
---

# Next.js 앱 배포하고 Teams에서 공유하기

상단 **앱(Apps)** 메뉴에서 Git 저장소를 연결하거나 팀 앱을 살펴보고 Next.js 예제를 열 수 있습니다. 앱은 웹앱과 API 서비스를 포함하며 Next.js는 지원하는 프레임워크 중 하나입니다.

## 예제로 시작하기

[Next.js Hello World 저장소](https://aindrive.ainetwork.ai/comcom/git/nextjs-hello-world)에는 페이지, 클릭 카운터, `/api/health`가 있습니다. [Ainize 프로젝트](https://ainize.ai/comcom/nextjs-hello-world)에서 배포 상태와 로그, 배포된 앱 링크를 확인할 수 있습니다.

저장소를 clone하거나 push 권한이 있는 저장소에 파일을 복사하세요. `package-lock.json`을 커밋하고 `node_modules`, `.next`, 비밀 값은 제외합니다.

```sh
git clone https://aindrive.ainetwork.ai/comcom/git/nextjs-hello-world
cd nextjs-hello-world
npm ci
npm run dev
```

자신의 저장소에 push할 때는 AIN Drive 계정에서 제공하는 Git 인증을 사용하세요. 토큰을 커밋되는 원격 URL이나 소스 파일에 넣지 마세요.

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

## Push하고 확인하기

앱을 커밋하고 조직의 AIN Drive Git 저장소에 push하세요. 루트에 `ainize.json`이 있는 저장소는 권한 있는 push가 들어오면 자동으로 연결됩니다. 브라우저에서 커밋하면 작업 사본에 저장됩니다. **Push**를 눌러 원격에 보내야 배포가 시작됩니다.

저장소의 **Deployments** 화면이나 Ainize 프로젝트 페이지를 여세요. **ready**가 되면 배포된 앱에서 카운터가 증가하는지, `/api/health`가 `ok: true`를 반환하는지 확인합니다. 실패하면 빌드 로그를 읽고 소스나 설정을 수정해 다시 push하세요.

## AIN Teams에서 저장소 공유하기

AIN Teams 메시지에 저장소 URL을 붙여 넣습니다.

```text
https://aindrive.ainetwork.ai/comcom/git/nextjs-hello-world
```

저장소 미리보기는 연결된 Ainize 프로젝트의 AIN-UI 카드를 제공합니다. 소스와 배포 상태를 확인하고 준비가 끝나면 배포된 앱 링크를 여세요. 계속 실행되는 Next.js 앱은 웹앱으로 열고, 스크립트는 Run 흐름을 사용합니다. 에이전트 채팅 UI를 제공하려면 [AIN Teams용 에이전트 만들기](./build-for-ainteams.md)를 참고하세요.
