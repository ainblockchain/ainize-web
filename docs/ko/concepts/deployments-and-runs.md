---
title: 배포와 실행의 차이
summary: Ainize의 프로젝트는 두 종류입니다. 배포(Deployment)는 계속 떠 있는 것 — 웹앱, API 서비스, 에이전트. 실행(Run)은 돌고 끝나는 스크립트 — 필요할 때, 스케줄로, AIN 블록체인이 바뀔 때, 웹훅으로. 내 리포가 어느 쪽인지, 무엇을 골라야 하는지.
source: en/concepts/deployments-and-runs.md
source_sha256: 07719a9644bb3871a34fe623c79f2d0f819a05dfd894fc4abd2df0f887e96301
---

# 배포와 실행의 차이

Ainize의 프로젝트는 모두 루트에 `ainize.json`이 있는 git 리포이고, push할 때마다 로그가 붙은 배포 기록이 남습니다.
하지만 배포되는 것의 모양은 둘로 또렷이 갈리고, 웹사이트는 둘을 따로 부릅니다.

- **배포(Deployment)** 는 *계속 떠서* 요청에 답하는 프로그램입니다. Next.js 사이트, HTTP 포트가 있는 Dockerfile
  서비스, A2A 에이전트. 노드가 빌드하고, 헬스체크를 기다리고, URL을 주고, 새 버전이 건강해질 때까지 이전 버전을 계속
  서비스합니다. 내 것은 [배포](/deployments)에 있습니다.
- **실행(Run)** 은 *돌고 끝나는* 프로그램입니다. Python이나 Node 스크립트. 노드가 샌드박스에서 한 번 돌리고 출력과
  종료 코드를 남기며, 무언가 요청할 때마다 다시 돕니다 — 내가, 스케줄이, AIN 블록체인의 쓰기가, HTTP 호출이. 내 것은
  [실행](/runs)에 있습니다.

리포가 어느 쪽인지는 `ainize.json`의 `kind`가 정합니다. `nextjs`·`service`·`agent`는 배포, `script`는 실행입니다.
콘솔(`/<org>/<repo>`)은 둘 다 같은 페이지입니다. 실행 프로젝트에는 트리거와 실행 기록이 있는 **실행** 탭이, 배포에는
런타임 로그를 실시간으로 보는 **로그** 탭이 있습니다.

## Google Cloud나 Vercel을 써 봤다면

| Ainize에서 | 가장 가까운 것 | 무엇인가 |
|---|---|---|
| 배포, `kind: nextjs` | Vercel 프로젝트 | push마다 빌드되어 URL에서 열리는 Next.js 앱. |
| 배포, `kind: service` | Cloud Run 서비스 · Fly 앱 | 포트가 있는 Dockerfile. 계속 떠 있고 무중단으로 교체됩니다. |
| 배포, `kind: agent` | 에이전트 카드가 달린 Cloud Run 서비스 | `/agents/<id>`에 공개되고 마켓플레이스에 오르는 A2A 에이전트. |
| 실행, 수동 | Cloud Run Job (`gcloud run jobs execute`) | `ainize.json`에 선언한 입력과 함께 실행 패널에서 시작하는 스크립트. |
| 실행, `type: schedule` | Cloud Scheduler → Cloud Run Job | 같은 스크립트를 5칸 cron과 원하는 시간대로. |
| 실행, `type: ain` | Cloud Functions Firestore 트리거 (`onWrite`) | AIN 블록체인의 경로가 쓰일 때 도는 스크립트. 그 경로에 둘 `_function` REST 규칙을 노드가 만들어 주고, 쓰기가 곧 이벤트가 됩니다. Firestore에서 AIN 블록체인으로 옮긴 데이터는 트리거 함수를 이 방식으로 그대로 가져갑니다. |
| 실행, `type: http` | Cloud Functions HTTP 트리거 · 웹훅 | 호출 URL이 토큰과 함께 불릴 때 도는 스크립트. 요청 본문이 이벤트가 됩니다. |

표의 어느 줄에도 `ainize.json`은 하나뿐입니다. 실행의 트리거는 `entry`를 적은 그 파일의 `triggers` 키이지, 따로
세워야 하는 두 번째 서비스가 아닙니다. [스크립트를 스케줄로 실행하기](../how-to/run-scripts-on-a-schedule.md)를
보세요.

## 무엇을 골라야 하나

아무도 부르지 않을 때 무슨 일이 일어나야 하는지 물어보세요.

- **그래도 열려 있어야 한다** — 페이지, 엔드포인트, 다른 누군가가 말을 거는 에이전트 → 배포. Next.js 앱은 `nextjs`,
  Dockerfile과 포트가 있는 무엇이든 `service`, A2A로 말하고 마켓플레이스에 올라야 하면 `agent`.
- **무슨 일이 생기기 전까지는 가만히 있어야 한다** — 매시간 도는 점검, 체인에 글이 써지면 반응하는 작업, 다른 시스템이
  HTTP 호출로 시작시키는 일, 입력을 바꿔 가며 손으로 돌리는 스크립트 → 실행. `script` 프로젝트 하나에, 손 안 대고 돌릴
  것은 `triggers`로.
- **둘 다 한다** — 매시간 도는 작업도 필요한 API → 프로젝트 둘. 원한다면 리포 하나에 폴더 둘(각각 자기 `ainize.json`)로,
  리포 페이지에 나란히 올라갑니다.

결정을 기울이는 것들:

| | 배포 | 실행 |
|---|---|---|
| 프로세스 수명 | 배포가 활성인 동안 계속 | 한 번의 실행, `timeoutMs`까지 (기본 2분, 최대 5분) |
| 네트워크 | 포트가 공개됨, egress는 게이트웨이를 통해 | 인바운드 없음, egress는 Ainize(`AINIZE_URL`)에만 |
| 매개변수 | 설정에서 넣는 환경변수 | 같음 + 실행마다의 `inputs` + `AINIZE_TRIGGER_EVENT`의 트리거 이벤트 |
| push가 하는 일 | 빌드하고 서비스 버전을 교체 | 스크립트를 한 번 돌리고(입력 기본값으로) 트리거를 설치 |
| 기록 | 배포마다 빌드 로그 | 실행마다 출력, 종료 코드, 시작시킨 트리거 |
| 비용의 모양 | 항상 켜진 컨테이너 | 실행 사이에는 아무것도 없음 |

## 둘이 공유하는 것

리포, push, 로그, 콘솔, 그리고 손댈 수 있는 사람. 프로젝트는 push한 사람이나 조직에 묶이고, 조직 구성원은 두 목록
모두에서 보며 실행·재배포·설정 변경을 할 수 있습니다(`canOperate`). 삭제는 소유자만 합니다(`canManage`). 비밀값은
프로젝트의 환경변수에 두고 `ainize.json`에는 절대 넣지 않습니다. 키 전체는
[ainize.json 레퍼런스](../how-to/deploy-with-ainize-json.md)에 있습니다.
