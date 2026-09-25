---
source: en/how-to/join-from-your-own-node.md
source_sha256: dbbe78522734b8f34e4116d2cc020b7812c5725ad4b2d45f9a16070ab53bb110
---

# 내 노드로 네트워크 참여하기

## 실행과 연결

Node 24 이상을 설치하고 새 홈 디렉터리를 사용합니다.

```bash
npm install -g ainize
export AINIZE_HOME="$HOME/ainize-joiner"
ainize init --name joiner --port 3455 --peer https://ainize.ai --roles seller
ainize start -d
ainize status
ainize login --node-key
ainize nodes
```

기본 로컬 원장은 CREDIT을 사용하며 AIN 메인넷과 잔액을 공유하지 않습니다.
다른 피어에 연결하기 전에 원장 호환성을 확인하세요.

## 런타임 연결

[빠른 시작](../get-started/quickstart.md)의 모델·패치 훅 설정을 따릅니다.
`runtime.gpus`에는 모델 컨테이너가 실제 사용하는 호스트 GPU 번호를 지정하세요.
준비가 끝난 뒤 `serving` 역할을 추가합니다.

```bash
ainize patch ls --status VERIFIED
ainize use <id>
ainize chat <id> "질문"
```

`<id>`를 카탈로그의 호환 지식으로 바꾸고 구매 견적을 확인하세요.

## 가르치기 활성화

실제 학습기는 별도 설치가 필요합니다. 컨테이너·스크립트·전용 GPU를 설정하세요.
CLI가 모델을 설치하거나 GPU를 제공하지는 않습니다.

```bash
ainize config set teach.enabled true
ainize config set teach.backend gradient
ainize config set runtime.gpus <serving-gpu-indices>
ainize config set teach.trainer.gpus <separate-training-gpu-indices>
ainize stop
ainize start -d
ainize teach status
```

서빙 GPU와 학습 GPU는 겹치면 안 됩니다. `runtime.patchDir`과 `runtime.api`는 같은 서빙 인스턴스를
가리켜야 합니다. 모델·데이터셋에 맞춰 학습 제한 시간을 정하세요. 과거 실험의 소요 시간은 성능 보장이 아닙니다.

이후 [파일로 가르치기](../tutorials/teach-from-a-file.md)를 진행합니다.

## 공개 주소 설정

TLS와 프록시는 [외부에서 접근 가능한 노드](./reachable-node.md)를 참고하세요.
비공개 노드는 지원되는 P2P 중계 기능을 사용할 수 있지만 파일을 중계할 접근 가능한 피어가 필요합니다.
원본과 키를 백업하세요. 중계는 백업 서비스가 아닙니다.

## 역할

| 역할 | 요건 |
|---|---|
| seller | 접근 가능한 API와 보관된 지식 파일. |
| serving | 호환 모델·패치 훅·충분한 연산 자원. |
| verifier | 저장 공간·대역폭·실행 검증용 호환 런타임. |

자동 검증을 켜기 전에 [검증자 비용](./run-a-verifier.md)을 확인하세요.
