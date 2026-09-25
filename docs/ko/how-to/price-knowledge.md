---
source: en/how-to/price-knowledge.md
source_sha256: 356f92a350af6e24bc75347b78c5a1fe0cd06de26450664d29a348108284b817
---

# 가격 설정과 수익 확인

가격은 노드 결제 통화 기준의 음이 아닌 십진수 문자열입니다.
`ainize status`로 통화를 먼저 확인하세요. 로컬 CREDIT은 온체인 토큰이 아니며,
통화 이름을 바꿔도 새로운 결제 백엔드가 설치되지는 않습니다.

## 기본 가격 또는 게시 가격 설정

```bash
ainize config get market.defaultPrice
ainize config set market.defaultPrice 2
ainize publish ./knowledge.npz --name "Office facts" --model <model-id> \
  --benchmark ./bench.json --price 2
```

실제 모델 ID와 호환 지식 파일·벤치마크를 사용합니다. 학습한 수업은
`ainize teach publish <job-id>`와 두 동의 플래그로 공개하세요.
명시한 가격은 기본값보다 우선합니다. 게시된 앵커는 영구 기록이므로,
새 가격을 안내하기 전에 CLI가 변경을 허용하는 항목인지 확인하세요.

## 기여자와 로열티

파일 게시 시 `--contributor <주소>:<이름>:<비율>`로 기여자를 지정합니다.
완전한 유효 주소를 사용하고 총 비율이 설정된 배분 한도를 넘지 않게 하세요.
부모 로열티와 기여자 지분은 계산 기준이 다릅니다.
[계보와 로열티](../concepts/lineage-and-royalties.md)를 참고하세요.

## 영수증 확인

```bash
ainize wallet
ainize ledger ls --kind settle --limit 5
ainize payouts ls
```

로컬 원장은 CREDIT 이체를 기록합니다. AIN 원장은 트랜잭션 수수료도 필요하며,
지급이 대기하거나 실패할 수 있습니다. 지급 상태를 확인한 뒤 수령 여부를 판단하세요.
