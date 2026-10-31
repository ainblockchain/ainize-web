---
source: en/how-to/call-the-model.md
source_sha256: cd52ac8879bfb3bd456dd9ab29203037af7af643456d76b0c6d0f080019bb084
---

# 내 코드에서 모델 호출하기

> 읽기보다 눌러보고 싶다면 — [모델 페이지](/models)가 이 노드가 서빙하는 것을 보여주고 세 가지를 브라우저에서
> 바로 실행합니다. 키도 예치도 없이. 그리고 같은 코드를 모델 이름까지 채워서 건네줍니다.

> 이 문서는 노드의 모델을 **쓰는** 쪽입니다 — 내 프로그램에서 대화, 음성, 이미지를 호출하는 이야기.
> 가르치는 쪽은 [모델을 고쳐 가르치기](../tutorials/teach-in-chat.md), 남의 지식을 사는 쪽은
> [남이 공개한 지식 쓰기](../tutorials/buy-and-apply.md)입니다.

Python SDK를 설치하고 환경 변수에 보관한 모델 API 키로 인증합니다.
**키는 사이트에서 받습니다.** AIN 계정이나 지갑으로 로그인한 뒤 모델 상세 화면에서 개인 키를 발급할 수 있습니다.
[키 관리](/me)에서는 권한이 있는 조직을 선택할 수도 있습니다. 브라우저에 보관한 키는 현재 계정과 노드에 속하며,
사용 가능 여부를 확인한 뒤 호출과 코드 예제에 사용합니다. 사용이 중지된 키는 저장할 수 있도록 원문을 유지하지만
호출에는 사용하지 않습니다. 폐기가 확인된 키는 화면에서 지웁니다.

발급 전 계정·노드·이름·조직과 요청 번호를 이 브라우저에 저장합니다. 페이지를 다시 열면 같은 요청의 결과만 조회하며
새 키를 자동으로 발급하지 않습니다. **같은 요청 다시 보내기**는 같은 번호로 두 번째 키를 발급하지 않습니다.
**미발급 요청 취소**는 늦게 도착한 요청의 발급도 막지만, 이미 발급됐다면 취소 완료 대신 해당 키를 표시합니다.
키가 발급됐어도 원문 응답을 받지 못했다면 서버에서 원문을 복구할 수 없습니다. 표시된 식별자로 키를 관리하거나 폐기하세요.
다른 키를 만들기 전에는 화면에 있는 키를 저장하고 지워 주세요. 이 흐름에는 브라우저 저장 공간과 탭 간 작업 조정이 필요합니다.
브라우저 데이터를 삭제하거나 다른 기기로 이동하면 이 브라우저의 복구 기록은 이어지지 않지만 계정의 키 목록은 조회할 수 있습니다.
요청별 발급을 지원하는 노드가 필요하며, 구형 노드에서는 기존 발급 방식으로 자동 전환하지 않습니다.

폐기할 때도 먼저 정확한 키 식별자를 저장합니다. 응답이 끊기면 **상태 확인**은 목록만 읽으며 폐기를 반복하지 않습니다.
동일한 키가 남아 있을 때만 명시적으로 폐기를 재시도할 수 있습니다. 확인된 기록은 사용자가 닫을 때까지 유지됩니다.
이 복구 기록에는 키 원문이 없습니다. 응답 유실은 작업 실패를 뜻하지 않습니다.

모델 링크에는 선택한 제공 노드와 모델 유형이 유지됩니다. 피어 목록에 등록됐다는 표시가 실제 응답 확인을 뜻하지는 않습니다.
**실행** 직전에 같은 노드가 같은 모델·유형을 제공하는지 다시 확인하며, 사라진 제공 노드를 다른 노드로 대신하지 않습니다.
목록을 읽지 못했거나 형식이 잘못되면 모델이 없다고 표시하지 않습니다. 로컬 모델의 제공 상태가 확인되지 않으면 실행할 수 없습니다.
AinCode 작업 공간 링크에는 이 화면의 모델·제공 노드 선택이 전달되지 않습니다.

이미 지갑을 들고 있는 프로그램(트랜잭션도 보내는 에이전트 같은)은 `private_key=`로 키를 자동 발급받을 수 있습니다.
그건 예외이지 quickstart가 아닙니다.

`connect()`는 표준 클라이언트를 반환하고, 여기서 요구하는 서명은 로그인이라 자금을 옮기지 않습니다.

```bash
pip install ainize
```

```python
import os
import ainize

client = ainize.connect(os.environ.get("AINIZE_URL", "https://ainize.ai"), api_key=os.environ["AINIZE_API_KEY"])
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

스트리밍은 `stream=True`를 지정하고 응답의 choices가 있을 때 읽습니다. 짧은 인사 예제에서는 추론을 꺼서 토큰을 실제 답변에 사용합니다.

```python
stream = client.chat.completions.create(
    model="Qwen3.8-Flash-Next",
    messages=[{"role": "user", "content": "안녕하세요라고 말하세요."}],
    max_tokens=32,
    stream=True,
    extra_body={"chat_template_kwargs": {"enable_thinking": False}},
)
for chunk in stream:
    if chunk.choices:
        print(chunk.choices[0].delta.content or "", end="", flush=True)
```

## 결정 모델 (Clef)

`clef-flash`와 `clef`는 채팅 모델이 아닙니다. `state`와 유형이 정해진 질문을 받아 확률로 답하며, 같은 클라이언트의
메서드 하나로 호출합니다 — `client.decide(model, state=..., questions=...)`, 모델이 받은 정확한 프롬프트를 보려면
`debug={"prompt": True}`. 질문 유형, 배치, 와이어 형식은 별도 페이지에 있습니다:
[결정 모델 쓰기 (Cloudflare Clef)](./decision-models-clef.md).

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
