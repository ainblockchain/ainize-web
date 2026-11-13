---
title: GitHub 리포 배포하기
summary: ainize에 GitHub 리포 주소를 넣으면 배포됩니다. 조직 드라이브에 AinDrive 저장소가 만들어지고, 프로젝트가 생기고, 이후 GitHub의 머지마다 다시 배포됩니다. 터미널은 필요 없습니다.
source: en/how-to/deploy-from-github.md
source_sha256: a18c376ff2cf50d0a4a145864f139e042c969d1a4bd47ae93891d5b9028fd223
---

# GitHub 리포 배포하기

코드는 GitHub에 있고 ainize에는 아직 아무것도 없는 경우입니다. 리포 주소만 넣으면 나머지는 ainize가 합니다. 조직이
배포에 쓰는 AinDrive 저장소를 만들고, 프로젝트를 만들고, 첫 배포를 돌리고, 그 뒤로는 GitHub 브랜치를 따라갑니다. CLI를
설치하거나 직접 push 할 일이 없습니다.

리포가 이미 ainize 프로젝트이고 GitHub만 따라가게 하고 싶다면, 프로젝트 설정의
[GitHub에서 동기화](./aindrive-git.md#3-github-는-사람들이-push-하는-곳으로-두기)를 켜면 됩니다.

## 준비물

- **조직**에 속한 ainize 계정. 저장소는 그 조직의 드라이브에 만들어지고, 프로젝트도 조직의 것이 됩니다.
- **공개** GitHub 리포. 비공개 리포는 운영자가 우리 조직에 허용한 GitHub 소유자의 것만 가져올 수 있습니다.
- ainize가 실행할 수 있는 것. Next.js 앱은 더 필요한 게 없습니다. 그 밖에는
  [`ainize.json`](./deploy-with-ainize-json.md)이 필요합니다. 리포에 이미 있거나, 3단계에서 폼에 적으면 됩니다.

## 순서

1. **배포** → **새 앱 배포**를 엽니다(주소는 `/projects/new`).
2. **리포 URL**에 GitHub 주소를 붙여 넣습니다. `https://github.com/<owner>/<repo>` 또는 `<owner>/<repo>`만 넣어도 됩니다.
   폼이 가져오기로 바뀌어 조직과 새로 만들 AinDrive 저장소 이름을 묻습니다(바꾸지 않으면 GitHub 리포 이름). **브랜치**는
   배포할 GitHub 브랜치이고 기본값은 `main`입니다.
3. 리포에 `ainize.json`이 없고 Next.js 앱도 아니라면 폼의 **ainize.json**을 펼쳐 적습니다. `Dockerfile`이 있는 서비스라면
   이 정도면 됩니다.

   ```json
   { "kind": "service", "port": 8080, "healthcheck": "/" }
   ```

4. **GitHub에서 가져와 배포**를 누릅니다.

그러면 화면에 세 단계가 나오고, 끝나면 프로젝트 페이지로 넘어갑니다.

| 단계 | 일어나는 일 | 걸리는 시간 |
|---|---|---|
| 가져오기를 요청했습니다 | ainize가 GitHub에서 리포를 확인하고 요청을 기록했습니다 | 즉시 |
| AinDrive 저장소를 만들고 GitHub 브랜치를 올립니다 | 동기화가 `aindrive.ainetwork.ai/<org>/git/<name>`을 만들고 그 브랜치를 `main`으로 올립니다 | 약 1분 안 |
| 프로젝트가 생기고 첫 배포가 시작됩니다 | AinDrive가 올라온 저장소를 새 프로젝트에 연결하고, 그 push가 배포됩니다 | push 뒤 몇 초 |

프로젝트 페이지가 열리면 첫 배포가 빌드 중이고, 로그도 그 페이지에 있습니다.

## `ainize.json`은 어디에 놓이나

| GitHub 브랜치가 | 배포에 쓰는 것 |
|---|---|
| `ainize.json`을 갖고 있음(루트 또는 모노레포의 1단계 폴더) | 그 파일. 폼에 적은 내용은 쓰지 않습니다. |
| 파일이 없는 공개 Next.js 앱 | `{ "kind": "nextjs" }`를 대신 넣어 줍니다 |
| 파일이 없고 폼에 적었음 | 폼에 적은 내용 |

아래 두 경우 파일은 GitHub 이력 위에 **AinDrive 쪽에만** 커밋됩니다. GitHub 리포에는 아무것도 쓰지 않습니다. 나중에
바꾸려면 AinDrive 리모트에 커밋하세요([방법](./aindrive-git.md#2-git-에-알려-주기)). GitHub 리포로 아예 옮겨도 되지만, 그때는
AinDrive 쪽 파일을 같이 지워야 합니다. 같은 파일이 양쪽에 추가되면 다음 동기화에서 머지 충돌이 납니다.

비공개 리포는 가져오기 전에 들여다볼 수 없어서, 파일이 없다는 것을 동기화가 발견합니다. 그러면 화면에
*has no ainize.json — import it again with one* 이라고 나오고, **고쳐서 다시 가져오기**를 누르면 폼으로 돌아갑니다.

## 가져온 뒤

이제 프로젝트는 **GitHub에서 동기화**를 직접 켠 것과 똑같이 GitHub 브랜치를 따라갑니다.

- GitHub의 머지는 약 10분 안에 AinDrive에 닿아 배포됩니다. 프로젝트 페이지의 **GitHub에서 지금 동기화**를 누르면 1분
  안에 시작합니다.
- 설정 → **GitHub에서 동기화**에서 마지막 확인 결과를 보고, 브랜치를 바꾸거나 동기화를 멈출 수 있습니다.
- 시크릿·도메인·스토리지 등은 다른 프로젝트와 똑같이 프로젝트에서 설정합니다
  ([ainize.json 레퍼런스](./deploy-with-ainize-json.md), [CI/CD](./ci-cd.md)).

## 안 될 때

| 화면에 나오는 말 | 뜻 | 할 일 |
|---|---|---|
| *GitHub 리포를 찾지 못했거나 비공개입니다* | ainize는 자격증명 없이 GitHub를 읽습니다. 비공개 리포는 조직에 허용된 GitHub 소유자의 것만 읽습니다 | 리포를 공개로 바꾸거나, 운영자에게 그 소유자를 허용해 달라고 요청하세요 |
| *GitHub 리포에 ainize.json이 없고 Next.js 앱도 아닙니다* | 어떻게 실행할지 알려 주는 것이 없습니다 | 폼에 `ainize.json`을 적으세요 |
| *그 이름의 저장소는 이미 프로젝트입니다* | AinDrive 저장소 이름이 이미 쓰이고 있습니다 | 다른 이름을 쓰거나, 그 프로젝트의 설정에서 GitHub를 연결하세요 |
| *그 조직의 구성원만 가져올 수 있습니다* | 조직의 활성 구성원이 아닙니다 | 조직 소유자에게 추가를 요청하세요 |
| *가져오지 못했습니다: creating the AinDrive repository was refused: …* | AinDrive가 push를 거절했습니다. 대개 시크릿 검사가 이력에서 자격증명을 찾은 경우입니다 | GitHub 이력에서 시크릿을 지운 뒤 다시 가져오세요 |

**가져오기 취소**는 아직 프로젝트가 되지 않은 요청을 지웁니다. 이미 올라간 내용은 AinDrive에 남습니다.

## API로 같은 일 하기

로그인한 상태(세션 쿠키 또는 API 키)에서, 조직 구성원으로 호출합니다.

```bash
curl -X POST https://ainize.ai/api/github-imports \
  -H 'content-type: application/json' \
  -d '{"repo": "my-org/my-app", "branch": "main", "org": "my-team", "name": "my-app",
       "manifest": {"kind": "service", "port": 8080}}'
```

`202`로 `{ import, status, project: null }`이 옵니다. `project`가 채워질 때까지 `GET /api/github-imports/my-team/my-app`을
폴링하세요(`status.state`는 `pending`, 그다음 `ok`, 또는 이유가 담긴 `error`). 같은 주소에 `DELETE`를 보내면 취소됩니다.
모든 필드와 오류 코드는 [HTTP API 레퍼런스](../reference/http-api.md)에 있습니다.
