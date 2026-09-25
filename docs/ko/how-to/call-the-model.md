---
source: en/how-to/call-the-model.md
source_sha256: 4734cb2ed2e784cc98edeaaea272871efbbc33c8b495e75f91a2b6d9d22cf82d
---

# 내 코드에서 모델 호출하기

> 읽기보다 눌러보고 싶다면 — [모델 페이지](/models)가 이 노드가 서빙하는 것을 보여주고 세 가지를 브라우저에서
> 바로 실행합니다. 키도 예치도 없이. 그리고 같은 코드를 모델 이름까지 채워서 건네줍니다.

> 이 문서는 노드의 모델을 **쓰는** 쪽입니다 — 내 프로그램에서 대화, 음성, 이미지를 호출하는 이야기.
> 가르치는 쪽은 [모델을 고쳐 가르치기](../tutorials/teach-in-chat.md), 남의 지식을 사는 쪽은
> [남이 공개한 지식 쓰기](../tutorials/buy-and-apply.md)입니다.

Python SDK를 설치하고 환경 변수에 보관한 지갑 키로 인증합니다.
**키는 사이트에서 받습니다.** 지갑으로 로그인한 뒤 [모델 페이지](/models)에서 발급하면, 그 페이지가 보여주는
코드에 바로 채워집니다. 개인키는 브라우저를 떠나지 않습니다 — 전송에 서명할 수 있는 키는 소스 파일에도, CI 변수에도,
스크린샷에도 있을 이유가 없고, 다른 어떤 LLM API도 그런 걸 요구하지 않습니다.

이미 지갑을 들고 있는 프로그램(트랜잭션도 보내는 에이전트 같은)은 `private_key=`로 키를 자동 발급받을 수 있습니다.
그건 예외이지 quickstart가 아닙니다.

`connect()`는 표준 클라이언트를 반환하고, 여기서 요구하는 서명은 로그인이라 자금을 옮기지 않습니다.

```bash
pip install ainize
```

```python
import os
import ainize

client = ainize.connect("https://ainize.ai", api_key=os.environ["AINIZE_API_KEY"])
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
