---
title: 내 노드로 네트워크에 합류하기
summary: 이 기계 바깥의 노드가 네트워크를 찾고, 지식을 받아 쓰고, 자기 지식을 되팔기까지 해야 하는 일 — 아무도 나에게 닿을 수 없는 경우까지.
source: en/how-to/join-from-your-own-node.md
source_sha256: cb6469cbdc453316df6768e484325a4fe93f5eef60ce4931671bf1adacbba8bd
---

# 내 노드로 네트워크에 합류하기

신청할 등록소도, 만들 계정도 없습니다. 모든 노드가 자기 원장을 갖고, 가십이 기록을 peer 사이로 나르며,
"마켓플레이스"란 내 원장이 들은 것의 총합입니다. `ainize.ai`는 권위가 아니라 입구입니다 — 합류란 그 주소를
한 번 대는 일입니다.

```
내 노드                                       peer들 (ainize.ai 포함)
  init --peer https://ainize.ai
       │ hello, 이어서 peer 교환
       └──────────────────────────────────▶  저쪽이 나를 알게 됨
       ◀──────────────────────────────────   내가 저쪽과 저쪽의 기록을 알게 됨
  teach train / teach publish
       │ 가십, 수 초
       └──────────────────────────────────▶  내 앵커가 저쪽 카탈로그에 나타남
                                             검증인들이 내 벤치마크를 직접 돌림
       ◀──────────────────────────────────   증명이 되돌아옴
  정족수 충족  ──▶  VERIFIED, 앵커가 닿은 모든 곳에서 판매 중
```

## 1. 합류

```bash
npm install -g ainize
ainize init --name joiner --port 3455 --peer https://ainize.ai --roles seller,serving
ainize start -d
```

```text
✓ node initialised at ~/.ainize/config.json
name        joiner
address     0x8fdAAE00D648273Be5AD9b7f7D6a19e1A6e94D04
listens on  127.0.0.1:3455  (this machine only)
ledger      local
roles       seller, serving
operator    password set — this node is claimed
the private key lives in ~/.ainize/config.json and this is the only copy — back it up now: `ainize keys backup <file>`
```

**peer 하나면 충분합니다.** 나머지는 peer 교환이 찾아냅니다. `https://ainize.ai` 하나만 준 노드에서 측정했습니다.
수 초 만에 peer 여섯을 알게 되었고, 요청한 적 없는 원장 기록 열아홉 개를 받았습니다.

```bash
ainize status
```

```text
joiner  http://localhost:3455  (pid 2621981)
address     0x8fdAAE00D648273Be5AD9b7f7D6a19e1A6e94D04
roles       seller, serving
ledger      local · local · 19 records · height 19
runtime     available · Qwen3.8-Flash-Next · hook ok
peers       6 known · 5 answered · 5 verifiers
patches     2 (0 verified)
quorum      2
blobs held  0 of 0 files on disk
```

두 줄만 읽으면 됩니다. **`peers`** — `known`은 들어 본 상대, `answered`는 실제로 답한 상대입니다. 알고는 있는데
끝내 답이 없는 peer는 없는 것이 아니라 닿지 않는 것입니다. **`patches`** — 내 원장이 들은 지식의 수와, 그중 독립
검증을 통과한 수입니다.

> [!WARNING]
> **`config.json`에 노드 개인키의 유일한 사본이 들어 있습니다.** 내가 공개하는 모든 것에 서명하고, 대금이 들어오는
> 주소이며, 복구 수단이 없습니다. 나중에 바꾸면 옛 신원으로 공개한 모든 것이 주인을 잃습니다.
>
> ```bash
> ainize keys backup ~/node-key.json --passphrase "기억할 수 있는 긴 암호"
> ```

이미 가진 신원을 쓰려면 `init`에 `--private-key <hex>`를 주면 됩니다.

## 2. 네트워크의 지식 받아 쓰기

산다고 판매자 모델을 호출하는 것이 아닙니다. 지식을 내려받아 **내** 런타임에 얹습니다. 판매자 노드는 서비스가
아니라 바이트의 출처입니다. `serving`에 자기 런타임이 필요한 이유가 그것입니다.

```bash
ainize config set runtime.api http://localhost:8002
ainize stop && ainize start -d
```

`ainize status`의 `runtime available` 줄이 나머지 전부의 전제입니다. 그다음은:

```bash
ainize patch ls --status VERIFIED -q "<주제>"
ainize use <id>
ainize chat <id> "내 질문"
```

`ainize use`가 검증 여부 확인 → 견적 → 결제 → 내려받기 → 적재까지 합니다. 재시작은 없습니다. `ainize chat`은 지식을
얹기 전과 후의 답을 나란히 보여 줍니다. 내가 산 것이 무엇인지 정직하게 보는 유일한 방법입니다.

### 아무도 검증하지 않은 것을 사기

판매자는 자기 지식이 아직 `ANNOUNCED`인 상태에서도 팔리도록 허용할 수 있습니다. 상태는 바뀌지 않습니다 —
`ANNOUNCED` 그대로이고 결코 `VERIFIED`가 되지 않습니다. 그러니 여기서 얻는 것은 이름표가 아니라 알고 내리는
선택입니다.

```text
! taught-ainize-lifecycle100-2026-cf9a6f is ANNOUNCED, NOT verified — 0/2 independent attestations.
  · its benchmark score is the seller's own claim until a verifier reproduces it
  · nobody independent has checked whether loading it damages unrelated answers
  · watch it instead: ainize patch get taught-ainize-lifecycle100-2026-cf9a6f — quorum is 2
Buy taught-ainize-lifecycle100-2026-cf9a6f unverified, at your own risk? [y/N]
```

스크립트에서는 `--yes`가 대신 답하고, 경고는 그대로 찍힙니다. 판매자가 허용하지 **않았다면** 거래는 멈춘 채로
있지 않고 거절되며 이유를 말합니다.

```text
error: taught-ainize-lifecycle100-2026-cf9a6f is ANNOUNCED (verification 0/2) — not verified yet, so it cannot be
bought here; the verifiers usually answer within a few minutes.
```

## 3. 내 지식 되팔기

```bash
ainize config set teach.enabled true
ainize config set teach.backend gradient
ainize stop && ainize start -d

ainize teach dataset upload questions.csv
ainize teach train <dataset-id>
ainize teach jobs                      # READY가 될 때까지 지켜봅니다
ainize teach publish <job-id>
```

`teach.backend gradient`에는 트레이너 컨테이너와 여유 GPU 메모리가 필요합니다. 없으면 백엔드가 `stub`이 되고,
공개 경로는 stub으로 만든 결과물을 일부러 거절합니다. 아무도 학습시키지 않은 수업은 지식이 아니기 때문입니다.

학습이 어디서 도는지는 설정 둘이 정하고, 첫 수업 전에 둘 다 맞아 있어야 합니다.

```bash
ainize config set runtime.gpus 0,1                  # 내 모델이 서빙에 쓰는 GPU
ainize config set teach.trainer.gpus 4,5,6          # 학습이 써도 되는 GPU — 위와 절대 겹치면 안 됩니다
ainize config set runtime.patchDir /runtime.api가_가리키는_인스턴스의_우편함
```

**`runtime.patchDir`를 빠뜨리기 쉬운데, 빠뜨리면 조용히 틀립니다.** 지식은 실행 중인 모델이 지켜보는 디렉터리를
통해 건네지고, 한 기계에서 모델 여러 개가 각자의 디렉터리를 볼 수 있습니다. 설정하지 않으면 노드는 기본값에 쓰는데
그 기본값이 `runtime.api`가 가리키는 것과 **다른 인스턴스**의 것일 수 있습니다. 그러면 지식은 아무도 묻지 않는 모델에
올라가고, 답은 그 지식을 본 적 없는 모델에서 나오며, 모든 라이브 테스트가 "이 지식은 아무것도 바꾸지 않았다"로
읽힙니다. `ainize status`는 우편함을 추측해야 했을 때 경고와 함께 찍어 줍니다. 증상은 그 한 줄이 전부입니다.

학습과 서빙은 GPU를 나눠 써서는 안 됩니다. 트레이너가 메모리 테이블 사본을 하나 더 올려서, 모든 검증과 라이브
테스트가 기대는 모델 서버를 굶깁니다. 두 집합이 겹치면 노드가 수업 시작을 거절하고, 검사한 GPU에 트레이너를
고정합니다.

`teach publish` 뒤부터는 내 손을 떠납니다. 앵커가 가십으로 퍼지고, 각 검증인이 내 지식을 **직접** 얹어 내 벤치마크를
돌리고, 서명된 증명이 돌아옵니다. 독립된 둘이 통과시키면 `VERIFIED`입니다.

정족수를 의미 있게 만드는 규칙이 둘 있습니다. 자기 지식은 자기가 검증할 수 없고, **런타임 하나를 공유하는 노드들은
하나로 셉니다** — 같은 모델을 두 번 돌리는 것은 두 번째 의견이 아닙니다.

## 4. 아무도 나에게 닿을 수 없다면

예전에는 여기서 조용히 실패했습니다. 공개하기 전에 읽으세요.

앵커는 가십을 타고 어디에나 도착합니다. 지식 **본체**는 그렇지 않습니다. 본체는 가져가는 쪽이 나에게 오는 방식으로
전달됩니다. NAT 뒤, 방화벽 뒤, 노트북 위에서는 `ainize teach publish`가 성공하고, 카탈로그에 내 지식이 보이고,
어떤 검증인도 그것을 내려받지 못합니다. 그래서 영원히 `ANNOUNCED`에 머물고, 어디에서도 오류가 나지 않습니다.

빠져나갈 길이 둘 있고, 공개하기 전에 하나를 골라 두는 편이 좋습니다.

**닿을 수 있게 하기.** 남이 쓸 수 있는 주소가 있다면 말해 주어야 합니다. 이 주소는 추측되지 않습니다.

```bash
ainize init … --public-url https://my-node.example.com --public
```

`--public`은 모든 인터페이스에 붙으므로 방화벽이나 프록시 뒤에서만 쓰세요. 운영자 비밀번호 없이 모든 인터페이스에
열린 노드는 먼저 닿은 사람의 것이 됩니다.

**또는 peer가 내 본체를 대신 들고 있게 하기.** 받아 주기로 한 노드가 `POST /p2p/blob/:sha`로 내 지식을 받아,
자기가 가졌다고 알리고, 검증인에게 대신 내어 줍니다. 내 노드는 `announce` 직후 자동으로 peer들에게 본체를 내밀고,
아무도 받지 않으면 그 사실을 분명히 말합니다.

```text
no peer accepted the body of <id> — verifiers must reach http://localhost:3455 themselves to fetch it.
If this node is not reachable from outside, <id> will stay ANNOUNCED: ask a peer to set `p2p.relayBlobs true`.
```

중계는 열린 저장소가 아니고, 올리는 쪽을 믿어야 성립하는 것도 아닙니다. 해시는 중계 노드가 가십으로 이미 알고 있는
앵커를 가리켜야 하고, 업로드는 **그 앵커의 저자**가 서명해야 하며, 도착한 바이트는 다시 해시되어 서명된 앵커가 이미
고정해 둔 해시와 다르면 거절됩니다.

들고 있는 쪽에서는 설정 하나와 한도 하나입니다. 남의 바이트를 들고 있는 일에는 비용이 들기 때문입니다.

```bash
ainize config set p2p.relayBlobs true
ainize config set p2p.maxRelayBytes 104857600
ainize stop && ainize start -d
```

## 역할마다 드는 비용

| 역할 | 내 노드가 하는 일 | 필요한 것 |
|---|---|---|
| `seller` | 자기 지식을 공개하고 판매 | 본체를 가져갈 수 있는 곳 — 자기 자신이거나 중계 노드 |
| `verifier` | 남의 벤치마크를 돌리고 증명에 서명 | 동작하는 런타임 |
| `serving` | 지식을 얹고 답변 | 훅이 붙은 런타임 |
| `gateway` | 자동 결제 엔드포인트 | — |

지식을 사서 쓰기만 할 노드에는 `serving` 하나면 충분하고, 그 밖에는 아무것도 필요 없습니다.
