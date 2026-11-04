---
title: Next.js 앱 배포하고 Teams에서 공유하기
summary: Next.js 저장소를 AIN Drive에 push하고 Ainize 배포를 확인한 뒤 AIN Teams에서 AIN-UI 카드로 공유합니다.
source: en/how-to/deploy-nextjs.md
source_sha256: 0aadaba2694eab8d19f5c30a6e1af755eb67835f8b42f50f95c2dd7555629281
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

## 기존 GitHub 앱 연결하기

1. 팀의 AIN 계정으로 로그인하고 **앱(Apps)**에서 조직을 선택합니다. 앱 저장소를 연결하고 배포할 브랜치를 고릅니다. 생성된 Ainize 프로젝트 URL을 기록하면 팀원도 같은 콘솔에서 상태를 확인할 수 있습니다.
2. GitHub를 따라가는 AinDrive 복사본은 **설정 → GitHub에서 동기화**에 `소유자/저장소`와 원본 브랜치를 입력하고 저장합니다. 비공개 저장소는 동기화 작업자의 GitHub 계정에도 읽기 권한이 필요합니다. 내 계정이 읽을 수 있다고 작업자도 읽을 수 있는 것은 아닙니다.
3. `ainize.json`과 잠금 파일을 커밋합니다. 모노레포의 `admin/` 등은 [배포 설정](./deploy-with-ainize-json.md)을 참고해 빌드 루트와 공유 파일을 지정합니다. 공개 빌드 값은 `build.args`, 실행 설정은 `env`, 자격 증명은 프로젝트 비밀 값 설정에 넣습니다. 누락되면 배포를 중단해야 하는 값은 `requiredSecrets`, `requiredEnv`, `build.requiredArgs`로 선언합니다.
4. 설정한 원본 브랜치에 머지하고 필요하면 **지금 GitHub에서 동기화**를 누릅니다. 동기화 결과와 최근·다음 확인 시각, GitHub 원본·프로젝트 소스·최근 빌드·운영 중인 커밋을 비교합니다. 대기 중인 요청은 동기화 성공이 아니며, 동기화 성공도 정상 배포를 뜻하지 않습니다. 서로 다르면 빌드 로그를 여세요.
5. 배포 주소에 실제 사용자로 로그인합니다. 해당 앱의 핵심 데이터 화면, 허용된 쓰기, 모델 응답, 업로드 파일을 확인합니다. 프로젝트 URL·운영 커밋·검증 시각·결과를 릴리스 기록에 남깁니다. 일상 배포는 커밋과 머지로 진행하므로 개발자가 배포 서버의 셸에 접속할 필요가 없습니다.

## Next.js 서버에서 자체 모델 호출하기

[모델](/models)에서 사용 가능한 모델을 고르고 제공 노드와 제공자를 확인한 뒤 ID를 사용합니다. 이름만 보고 자체 모델이라고 판단하지 마세요. 사설 GPU 주소 대신 Ainize 모델 API를 사용하면 배포된 앱이 실행 환경에서 `AINIZE_URL`과 `AINIZE_API_KEY`를 받습니다. 이 값은 서버 안에서만 사용합니다. 선택한 모델 ID를 비밀 값이 아닌 `MODEL_ID`로 설정하고 `ainize.json`의 `requiredEnv`에 추가하세요.

예를 들어 `lib/model.ts`에 아래 함수를 둡니다. 호출자의 로그인과 사용량 제한을 이미 확인하는 앱 경로에서 호출하세요. 이 함수가 앱 인증을 대신하지는 않습니다.

```ts
import 'server-only';

export async function askModel(question: string): Promise<string> {
  const { AINIZE_URL, AINIZE_API_KEY, MODEL_ID } = process.env;
  if (!AINIZE_URL || !AINIZE_API_KEY || !MODEL_ID) {
    throw new Error('Model configuration is missing');
  }
  const response = await fetch(`${AINIZE_URL.replace(/\/$/, '')}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AINIZE_API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL_ID, messages: [{ role: 'user', content: question }] }),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Model request failed (${response.status})`);
  const result = await response.json();
  const answer = result.choices?.[0]?.message?.content;
  if (typeof answer !== 'string') throw new Error('Model returned no text answer');
  return answer;
}
```

이 예제는 채팅 모델용입니다. 이미지·음성·판단 모델은 요청 형식이 다르므로 해당 모델 페이지의 예제를 사용하세요. 키 이름을 `NEXT_PUBLIC_*`로 바꾸거나 브라우저에 반환하지 마세요. 로컬 개발에서는 [모델 키 안내](./call-the-model.md)에 따라 별도 범위의 키를 발급하고 운영 실행 키를 복사하지 마세요.

## 서비스 데이터를 잃지 않고 외부 데이터 이전하기

앱 코드를 옮겨도 Firebase, DB, 업로드 파일, 인증, 백그라운드 작업이 자동으로 옮겨지지는 않습니다. 저장소에 이전 기록을 두고 프로젝트 **운영(Operations)** 탭에도 현재 연결 관계와 남은 확인 사항을 등록합니다. 의존성마다 다음을 기록하세요.

| 원본 | 대상 | 검증과 담당자 |
| --- | --- | --- |
| 클라우드 프로젝트 ID, DB·컬렉션 또는 버킷, 리전 | Ainize 프로젝트와 Store·AinDrive 위치 | 담당자, 내보내기 시각, 레코드 수와 표본 체크섬 |
| 로그인 제공자, 콜백 URL, 서비스 계정 | 사용할 계정·조직과 새 콜백 또는 서비스 계정 | 로그인·권한 거부·권한 회수 결과 |
| 작업·웹훅·트리거와 호출자 | Run·프로젝트 URL, 일정과 시간대 | 최근 성공 실행과 남아 있는 원본 주소 호출 |

AIN Blockchain이 권한을 담당하고 AinDrive가 본문을 보관할 문서 데이터는 [AIN Store 설계](../design/ain-data-platform.md)를 따릅니다. 설계 승인이 모든 SDK·트리거 기능의 배포를 증명하지는 않으므로 소량의 시험 가져오기로 대상이 지원하는 동작을 먼저 확인하세요. Postgres·Blob [관리형 저장소](./managed-storage.md)는 별도의 저장 방식이며, 이를 연결했다고 Firebase 앱이 AIN Store로 전환된 것은 아닙니다. 팀의 목표가 AIN Store·AinDrive라면 다른 방식을 쓰는 이유를 예외로 기록하세요.

1. 원본 소유자의 권한으로 문서, 파일 본문, 필요한 메타데이터를 내보냅니다. 원본 ID·개수·바이트 수·체크섬을 기록합니다. 변경하지 않을 내보내기 사본을 보관하고 전환 전에 격리된 대상에서 복원이 되는지 검증합니다.
2. 앱의 데이터 접근 코드를 대상에 맞게 구현합니다. 문서 ID·시각·참조·쿼리와 인덱스 동작·파일 콘텐츠 유형을 보존합니다. Firebase 전용 리스너·보안 규칙·트리거는 각각 대체해야 하며 JSON 복사만으로 재현되지 않습니다. 사용자와 조직 권한을 연결하고 허용·거부 동작을 모두 시험합니다.
3. 별도 시험 프로젝트·위치에 가져온 뒤 개수와 표본 내용을 대조하고 인증된 앱으로 확인합니다. 페이지 이동, 쓰기, 파일 다운로드, 작업 결과도 검증합니다. 관계형 DB를 예외로 유지한다면 관리형 저장소 안내의 덤프·가져오기·릴리스 시 스키마 마이그레이션을 참고하세요.
4. 전환 시각과 되돌리기 담당자를 정합니다. 잠시 쓰기를 중단하거나 내보내기 이후의 모든 변경과 삭제를 추적해 재적용합니다. 서버 설정을 전환하기 전에 다시 대조하세요. 두 곳에 쓰는 동안 어느 쪽이 기준이며 재적용 중복을 어떻게 막는지 정해야 합니다. 이중 쓰기가 저절로 일치한다고 가정하지 마세요.
5. 설정을 바꾸고 배포한 뒤 같은 로그인 사용자 흐름을 다시 검증합니다. 운영 커밋·대상 위치·시각을 기록합니다. 새 쓰기가 생긴 뒤 되돌려야 한다면 연결을 바꾸기 전에 그 쓰기도 대조·반영해야 합니다. 코드만 되돌리면 데이터를 잃을 수 있습니다.
6. 가장 긴 주기 작업이 포함된 합의된 기간 동안 원본 접근 로그·결제 지표·예약 작업을 관찰합니다. 남은 호출자를 담당자·주소별로 기록합니다. 잔존 호출을 해결하고 되돌리기·복원 검증이 끝날 때까지 필요한 원본 결제와 자원은 유지합니다. 이후 원본 종료를 앱 배포와 별도로 기록하세요.
