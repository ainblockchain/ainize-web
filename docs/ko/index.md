---
source: en/index.md
source_sha256: d5f68703490ba98e01de002c3dbf549a138a95a4b0a3655a8e8585b3356e842f
---

# Ainize

Ainize는 질문·정답으로 모델을 가르치고, 결과를 시험하고, 다른 노드와 지식을 공유하거나 사용하는 서비스입니다.

## 사용 방법

| 도구 | 용도 |
|---|---|
| 웹사이트 | [ainize.ai](https://ainize.ai)에서 탐색·대화·학습·공개 기록 조회 |
| CLI | `ainize`로 노드 운영과 작업 자동화 |
| 모델 API | [Python SDK](./how-to/call-the-model.md)로 설정된 모델 호출 |
| 에이전트 | 기존 에이전트를 노드에 등록하여 제공. [에이전트 호스팅](./how-to/host-an-agent.md) 참고 |

웹사이트와 노드 API는 별도로 배포합니다. CLI 설치만으로 웹사이트나 모델 서버가 준비되지는 않습니다.

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
