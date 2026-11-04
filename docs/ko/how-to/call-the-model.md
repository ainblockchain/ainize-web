---
source: en/how-to/call-the-model.md
source_sha256: f4b00f5dfd5f8628e620c94de04360ceca6be2d33946fb716af506d53e8fdad8
---

# 내 코드에서 모델 호출하기

> 읽기보다 눌러보고 싶다면 — [모델 페이지](/models)가 이 노드가 서빙하는 것을 보여주고 세 가지를 브라우저에서
> 바로 실행합니다. 키도 예치도 없이. 그리고 같은 코드를 모델 이름까지 채워서 건네줍니다.

> 이 문서는 노드의 모델을 **쓰는** 쪽입니다 — 내 프로그램에서 대화, 음성, 이미지를 호출하는 이야기.
> 가르치는 쪽은 [모델을 고쳐 가르치기](../tutorials/teach-in-chat.md), 남의 지식을 사는 쪽은
> [남이 공개한 지식 쓰기](../tutorials/buy-and-apply.md)입니다.

Python SDK를 설치하고 환경 변수에 보관한 모델 API 키로 인증합니다.
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

client = ainize.connect(os.environ.get("AINIZE_URL", "https://ainize.ai"), api_key=os.environ["AINIZE_API_KEY"])
models = client.models.list().data
print([model.id for model in models])
```

## 로그인하고 키의 소유자 선택하기

1. 모델 페이지에서 **로그인하고 키 발급받기**를 누르세요. AIN SSO 계정은 **Continue with AIN**으로 로그인합니다. 지갑과 Google 로그인도 지원합니다.
2. 모델 페이지에서 발급한 AIN SSO 키는 로그인 때 선택한 조직에 연결됩니다. 조직 또는 개인 키를 직접 선택하려면 [내 키](/me)에서 소유자를 선택하고 이름을 입력해 발급하세요. 현재 소속된 조직만 선택할 수 있습니다.
3. 발급 직후 한 번 표시되는 키를 복사해 서버의 `AINIZE_API_KEY` 비밀값으로 저장하세요. 목록에서는 접두사만 확인할 수 있고 원래 값을 복구할 수 없습니다. 분실하면 새 키를 발급하고 기존 키를 폐기하세요.
4. 위 Python 예제를 서버나 개발용 컴퓨터에서 실행하세요. 키를 브라우저 번들, `NEXT_PUBLIC_*` 환경변수, 소스 저장소, 스크린샷 또는 채팅에 넣지 마세요.

### 예제 저장소가 보이지 않을 때

모델 API 키와 저장소 접근 권한은 별개입니다. `comcom/git/clef-artwork-search` 같은 AinDrive 예제가 403을 반환하거나 보이지 않으면, 의도한 AIN 계정과 조직으로 AinDrive에 로그인했는지 확인하세요. `comcom` 조직 또는 저장소 관리자에게 저장소 URL과 계정 식별자를 알려주고 **해당 저장소의 읽기 권한**을 요청하세요. 요청에 API 키를 포함하지 마세요. 404는 경로가 변경된 경우에도 발생하므로 소유자에게 현재 주소를 확인하세요.

저장소 권한을 확인하는 동안에도 이 페이지의 API 예제를 사용할 수 있습니다. 예제 저장소를 내려받을 필요는 없습니다.

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
