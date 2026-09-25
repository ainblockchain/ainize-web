---
source: en/how-to/call-the-model.md
source_sha256: d38b1938e9e501f09a2c8d55150b3ebb927668c88464d94dfb79028f8b701c1e
---

# 내 코드에서 모델 호출하기

Python SDK를 설치하고 환경 변수에 보관한 지갑 키로 인증합니다.
`connect()`는 표준 OpenAI 호환 클라이언트를 반환합니다. 로그인 서명은 자금을 이체하지 않습니다.

```bash
pip install ainize
```

```python
import os
import ainize

client = ainize.connect("https://ainize.ai", private_key=os.environ["AINIZE_PRIVATE_KEY"])
models = client.models.list().data
print([model.id for model in models])
```

## 채팅

노드의 모델 목록에 있는 채팅 모델을 선택하세요. 공개 배포에서는 `Qwen3.8-Flash-Next`를 제공합니다.

```python
response = client.chat.completions.create(
    model="Qwen3.8-Flash-Next",
    messages=[{"role": "user", "content": "GPU란 무엇인가요? 한 문장으로 답하세요."}],
    max_tokens=128,
)
print(response.choices[0].message.content)
```

스트리밍은 `stream=True`를 지정하고 응답의 choices가 있을 때 읽습니다.

```python
stream = client.chat.completions.create(
    model="Qwen3.8-Flash-Next",
    messages=[{"role": "user", "content": "안녕하세요라고 말하세요."}],
    max_tokens=32,
    stream=True,
)
for chunk in stream:
    if chunk.choices:
        print(chunk.choices[0].delta.content or "", end="", flush=True)
```

## 지원 범위와 한도

모델과 입출력 종류는 노드별로 설정합니다. 음성 인식과 이미지 생성에는 별도 백엔드가 필요하며
SDK 설치만으로 활성화되지 않습니다. TypeScript 클라이언트는 `@ainize/sdk`입니다.

| 상태 / 코드 | 조치 |
|---|---|
| 401 `invalid_api_key` | 다시 인증합니다. |
| 404 `model_not_found` | 모델 목록과 정확한 ID를 확인합니다. |
| 400 `invalid_request` | 안내된 필드를 수정하거나 요청 크기를 줄입니다. |
| 429 `queue_too_deep` / `quota_exhausted` | 응답의 재시도 시간을 따릅니다. |
| 503 `backend_unavailable` | 모델 서비스가 복구된 뒤 재시도합니다. |

예치는 선택 기능이며 이 예제의 필수 조건이 아닙니다. 운영자가 수신 주소·지원 체인·조건을
설정하고 안내한 노드에서만 예치 도우미를 사용하세요. 공개 채팅 예제는 AIN 전송이 필요하지 않습니다.

## 운영자 설정

노드의 `backends` 항목에 모델 ID·입출력 종류·업스트림 URL을 설정합니다.
프록시는 인증을 포함한 **모든 `/v1/*` 경로**와 스트리밍을 전달해야 합니다.
Ainize web은 `AINIZE_NODE_URL`로 해당 노드에 연결합니다.
