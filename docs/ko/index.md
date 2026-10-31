---
source: en/index.md
source_sha256: 1ed90456a4257e72210313d72329798530d04ff21be3bacdd52e118d98b3b9f3
---

# Ainize

Ainize는 git push 한 번으로 코드를 배포하고, 질문·정답으로 모델을 가르치고, 결과를 시험하고, 다른 노드와 지식을 공유하거나 사용하는 서비스입니다.

## 사용 방법

| 도구 | 용도 |
|---|---|
| 웹사이트 | [ainize.ai](https://ainize.ai)에서 탐색·대화·학습·공개 기록 조회 |
| CLI | `ainize`로 노드 운영과 작업 자동화 |
| 모델 API | [Python SDK](./how-to/call-the-model.md)로 설정된 모델 호출 |
| 결정 모델 | Cloudflare Clef에 상황에 대한 유형별 질문을 던지고 확률을 받기: [결정 모델 쓰기](./how-to/decision-models-clef.md) |
| 배포 | `ainize.json`이 있는 git 리포는 push마다 배포되어 URL에 계속 떠 있음 — Next.js 앱, Dockerfile 서비스, A2A 에이전트. [리포 배포하기](./how-to/deploy-with-ainize-json.md) 참고 |
| 실행 | 돌고 끝나는 스크립트 — 필요할 때, cron 스케줄로, AIN 블록체인의 경로가 쓰일 때, 웹훅으로. [스크립트를 스케줄로 실행하기](./how-to/run-scripts-on-a-schedule.md) 참고 |
| 에이전트 | 기존 에이전트를 노드에 등록하여 제공. [에이전트 호스팅](./how-to/host-an-agent.md) 참고 |

웹사이트와 노드 API는 별도로 배포합니다. CLI 설치만으로 웹사이트나 모델 서버가 준비되지는 않습니다.

## 배포와 실행

`ainize.json` 하나에서 두 가지가 나오고, 웹사이트는 둘을 따로 보여 줍니다.

- **[배포(Deployments)](/deployments)** 는 계속 떠서 요청에 답하는 프로그램입니다 — 웹앱(`kind: nextjs`), API
  서비스(`service`), 에이전트(`agent`). push하면 새 버전을 빌드해 무중단으로 바꿔 끼웁니다. Vercel 프로젝트나 Cloud Run
  서비스와 같습니다.
- **[실행(Runs)](/runs)** 은 돌고 끝나는 스크립트(`kind: script`)입니다. 실행 버튼을 누를 때 돌고, `triggers` 키를
  더하면 스스로 돕니다 — cron 스케줄로, AIN 블록체인의 경로가 쓰일 때(AIN DB `_function` REST 규칙을 통한 Firestore
  트리거의 대응물), 웹훅 URL이 호출될 때. Cloud Run Jobs, Cloud Scheduler, Cloud Functions 트리거가 파일 하나에 들어갑니다.

아무도 부르지 않아도 열려 있어야 하면 배포, 무슨 일이 생기기 전까지 가만히 있어야 하면 실행입니다. 비교표는
[배포와 실행의 차이](./concepts/deployments-and-runs.md)에 있습니다.

## Train

[Train](/train)에서 모델 학습과 학습된 지식을 함께 관리합니다.

- **학습 시작**: 대화 중 답변을 바로잡거나 질문·정답 데이터셋을 업로드합니다.
- **학습된 지식**: 공개된 학습 결과를 둘러보고 상단 검색바로 찾습니다.
- **내 데이터와 학습**: 이 브라우저에서 만든 데이터셋, 학습 기록과 결과를 확인합니다.

기존 Knowledge와 Teach 메뉴는 Train으로 통합되었습니다. 기존 `/explore` 지식 링크와 `/teach` 학습 링크도 해당 Train 화면으로 연결됩니다. 학습 가능 여부는 노드 설정에 따르며, 학습이 중단되어도 지식 목록은 볼 수 있습니다.

## 노드 확인

```bash
ainize status --node https://ainize.ai
curl --fail https://ainize.ai/api/info
```

API가 응답해도 학습·추론이 설정되어 있다는 뜻은 아닙니다. 모델 기능을 쓰기 전에 런타임 상태를 확인하세요.

## 용어

| 용어 | 뜻 |
|---|---|
| 지식 | 호환 모델에 넣고 뺄 수 있는 학습된 메모리 패치 |
| 라이브 테스트 | 패치를 넣기 전후의 모델 답변 비교 |
| 검증 완료 | 필요한 검증 증거가 있음. 모든 답변의 정확성이나 현재 파일 제공 여부를 보장하지 않음 |
| 공개 기록 | 노드 원장에 기록된 등록·검증·구매 내역 |

[설치](./get-started/install.md) 또는 [빠른 시작](./get-started/quickstart.md)에서 시작하세요. API 필드는 [OpenAPI](/api/openapi.json), 명령 옵션은 `ainize <command> --help`에서 확인합니다.
