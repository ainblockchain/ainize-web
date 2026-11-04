---
title: CI/CD — push 하나가 서버가 되기까지
summary: Ainize 는 파이프라인의 CD 절반을 대신 관리합니다. git push 가 레포를 빌드하고, 필수 설정과 헬스체크로 게이트를 걸고, 무중단으로 새 버전으로 교체하며, 무엇이든 실패하면 이전 버전이 계속 서비스합니다. 테스트는 GitHub Actions 가 아니라 빌드 명령 안의 체크나 Ainize Run 으로 돌리고, 롤백은 이전 배포를 다시 배포해서 합니다. 스케줄·웹훅 작업은 Run 입니다.
---

# CI/CD — push 하나가 서버가 되기까지

**Ainize 로 젠킨스처럼 서버 CI/CD 가 되나요?** 됩니다. 다만 역할 분담이 다릅니다. 파이프라인 단계를 직접 짜지 않습니다.
**git push 자체가 파이프라인**입니다: Ainize 가 레포를 빌드하고, 게이트를 걸고, 무중단으로 새 버전으로 바꾸며, 무엇이든
실패하면 이전 버전이 계속 서비스합니다. 이것이 관리형 **CD** 절반입니다. **CI** 절반 — 테스트·린트를 게이트로 돌리는 것 —
도 Ainize 에서 돕니다: 빌드 명령 안의 체크, 또는 테스트 스위트를 돌리는 **Ainize Run**. 결과는 젠킨스가 주는 것 —
*테스트하고, 배포하고, 되돌릴 수 있다* — 을 직접 호스팅·스크립팅하는 서버 없이 Ainize 조각으로 조립한 것입니다.

> **GitHub Actions 는 쓰지 않습니다.** 여기의 CI/CD 는 전부 Ainize 에서 돕니다 — 빌드, 테스트 게이트(빌드 체크 또는
> Ainize Run), 배포와 그 트리거까지. GitHub 는 코드를 두고 리뷰하는 곳일 뿐, 파이프라인을 돌리지 않습니다. 예전에 GitHub
> Actions 워크플로에 있던 일은 [Ainize Run](./run-scripts-on-a-schedule.md) 으로 옮깁니다.

| 젠킨스 | Ainize |
|---|---|
| 설치·업데이트·보안을 직접 하는 서버 | 호스팅할 것 없음; push 가 트리거 |
| `stages` 를 적은 `Jenkinsfile` | `ainize.json` 이 빌드를 선언; 단계(빌드 → 게이트 → 헬스 → 교체)는 고정·관리형 |
| 빌드 에이전트가 테스트 실행 | 빌드 명령 안의 체크, 또는 스위트를 돌리는 Ainize Run(`kind: script`) — GitHub Actions **아님** |
| 직접 스크립트한 배포·롤백 | 헬스 게이트 무중단 교체; 실패 시 이전 버전 유지; **롤백 = 지난 배포 다시 배포** |
| 작업에 건 `cron`·웹훅 트리거 | [Run](../concepts/deployments-and-runs.md) 의 `schedule`·`ain`·`http` 트리거 |

## push 한 번이 하는 일 (관리형 파이프라인)

프로젝트는 루트에 [`ainize.json`](./deploy-with-ainize-json.md) 이 있는 git 레포입니다. 브랜치(기본 `main`)에 push 하면
노드가 아래 단계를 순서대로 돌리고, **배포** 하나를 기록합니다(`queued → building → ready` 또는 `error`). 로그는
실시간으로 흐르고 URL 이 붙습니다:

1. **해당 커밋을 clone** 하고 `ainize.json`(계약서)을 읽습니다. 빌드 방식은 서버에 설정하지 않습니다 — 배포 방식을 바꾸는
   것은 설정 변경이 아니라 커밋입니다.
2. **설정 게이트(빌드 전).** `requiredSecrets`·`requiredEnv`·`build.requiredArgs` 가 비어 있지 않아야 하고, `required`
   로 표시한 `storage` 항목은 스토어에 연결돼 있어야 합니다. 빠지면 여기서 이름과 함께 실패하고, 빌드는 시작조차 안 합니다.
3. **빌드**(`kind` 별): `nextjs` → `npm ci && npm run build`; `service` → 당신의 `Dockerfile`; `agent` → 호스티드
   에이전트 이미지; `script` → 빌드 없음(실행). 빌드 명령이 테스트를 돌린다면 여기서 돕니다 — 빌드 실패는 배포 실패입니다.
4. **릴리스 단계**(선언했다면): `release.command` 가 빌드된 이미지에서 **트래픽을 받기 전에** 실행됩니다 — DB 마이그레이션이
   여기입니다. 종료 코드가 0 이 아니면 배포 실패입니다.
5. **헬스 게이트.** 노드가 컨테이너를 띄우고 `port` 의 `healthcheck`(기본 `/`)가 200 을 줄 때까지 폴링합니다.
6. **무중단 교체.** 이때서야 새 버전이 트래픽을 받습니다. 이 순간까지 모든 요청은 이전 버전이 처리했습니다.

**어느 단계에서든 실패하면 이전 배포가 계속 서비스합니다.** 이유가 담긴 빨간 배포 로그를 받고, 사용자가 닿는 것은 아무것도
바뀌지 않습니다. `GET /api/projects/{id}/deployments` 가 목록을, `GET /api/deployments/{id}/log` 가 로그를 줍니다.
AinDrive 에서는 커밋마다 배포 점(building / ready / error)과 *Inspect*·*Visit* 이 보입니다.

## CI 절반: GitHub Actions 없이 배포 전에 테스트하기

Ainize 가 별도 테스트 단계를 대신 돌려 주지는 않고, 파이프라인은 GitHub Actions 를 쓰지 않습니다 — 게이트를 Ainize 안
둘 중 한 곳에 두세요:

- **빌드 명령 안(가장 간단한 게이트).** 체크를 빌드에 넣어 테스트 실패가 빌드 실패 = 배포 실패가 되게 하세요: `npm run
  build` 가 먼저 `npm test` 를 돌리는 `nextjs`(또는 `npm run lint && npm run typecheck && npm test && next build`),
  또는 빌드 스테이지에서 스위트를 돌려 통과할 때만 런타임 이미지를 만드는 `service` `Dockerfile`. 어떤 실패든 이전 버전이
  계속 서비스하므로 빨간 테스트가 사용자에게 닿지 않습니다.
- **Ainize Run 으로(배포를 게이트하는 테스트 스위트).** 테스트를 `kind: script` 프로젝트(또는 같은 레포 안 두 번째
  `ainize.json` 폴더)로 만들어 [트리거](./run-scripts-on-a-schedule.md) 로 돌리세요 — push, 스케줄, 또는 배포 단계가
  먼저 호출하는 웹훅. Run 이 통과/실패를 로그와 함께 기록하니, 초록 Run 일 때만 배포가 따라가게 묶습니다. GitHub Actions
  워크플로의 잡이 바로 여기로 옮겨옵니다 — 같은 명령을 Ainize 가 돌립니다.

AinDrive 가 배포 remote 이고 **AinDrive push 가 곧 배포**이므로, 게이트는 그 push 앞에 놓입니다: 빌드 체크는 빌드의
일부로 돌고, 별도 테스트 Run 은 먼저 초록이어야 하는 단계입니다. 소스를 리뷰용으로 GitHub 에 두는 것은 괜찮습니다 —
GitHub 은 파이프라인을 돌리지 않을 뿐입니다.

## 롤백

모든 push 가 배포로 남으므로, 되돌리기는 지난 배포를 다시 배포하는 것입니다:

- **정상이던 버전으로 롤백** — 그 지난 배포(같은 커밋)를 다시 배포:
  `POST /api/deployments/{deploymentId}/redeploy`(소유자 또는 조직원; 콘솔의 "roll back to this one").
- **최신 커밋 재빌드**(시크릿이나 연결 스토어를 바꾼 뒤): `POST /api/projects/{id}/redeploy`.

재배포도 평범한 배포라서 같은 게이트와 헬스 체크 교체를 거칩니다 — 건강하게 못 뜨는 롤백은 트래픽을 받지 못합니다.

## 서버 아닌 작업: 스케줄·트리거 Run

파이프라인에는 서버가 아닌 조각이 흔히 있습니다 — 야간 점검, 다른 시스템이 띄우는 작업. 그건 **Run**(`kind: script`)
입니다: `triggers` 키 하나로 스크립트를 `schedule`(cron + 타임존), `ain`(AIN 블록체인 경로 쓰기, Firestore 트리거에
해당), `http`(토큰 붙은 웹훅 URL) 로 실행합니다. 트리거 이벤트는 `AINIZE_TRIGGER_EVENT` 로 들어옵니다.
[스케줄로 스크립트 실행하기](./run-scripts-on-a-schedule.md)를 보세요. 배포 후 스모크 체크·캐시 워머·주기 데이터 작업
같은 Cloud Scheduler/웹훅 함수 쪽을 별도 시스템 없이 둘 수 있습니다.

## 시크릿과 설정

`ainize.json` 의 `env` 는 레포에 커밋되므로 비밀 아닌 빌드/런타임 값에만 씁니다. 진짜 시크릿은 프로젝트 시크릿
스토어(Settings)에 두고 빌드·런타임에 주입되며, `ainize.json` 에는 절대 적지 않습니다. 연결된 관리형 스토어는 배포 시
`DATABASE_URL`·`S3_ENDPOINT` 등을 앱에 넘깁니다([관리형 스토리지](./managed-storage.md)).

## 요약

- **CD 는 네이티브·관리형**: push → 게이트 → 빌드 → 릴리스 → 헬스체크 → 무중단 교체. 새 버전이 입증될 때까지 이전 버전이
  서비스하고, push 마다 전체 히스토리가 남습니다.
- **CI 는 GitHub Actions 가 아니라 Ainize 에서**: 빌드 명령 안의 체크, 또는 스위트를 돌리는 Ainize Run — 초록 게이트만 배포됩니다.
- **롤백**은 지난 배포를 다시 배포.
- **스케줄·웹훅 작업**은 `schedule`·`ain`·`http` 트리거를 단 Run.
