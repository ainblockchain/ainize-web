---
source: en/how-to/failed-verification.md
source_sha256: c5e132b6cd7c650ae38b5a5b32e392bf4b047a256f12b60ee1e8f1a64d425278
---

# 판매 목록에 나오지 않을 때

## 근거부터 확인

```bash
ainize patch get <id>
ainize patch records <id>
ainize logs --kind verifier
ainize nodes
```

| 상태 | 확인할 내용 |
|---|---|
| ANNOUNCED | 아직 검증 기록이 없습니다. 파일 접근과 피어 연결을 확인하세요. |
| VERIFYING | 정족수 또는 실제 실행 검증 요건을 충족하지 못했습니다. |
| VERIFIED | 노드 정책상 판매 가능합니다. 검증 기록에서 측정 내용을 확인하세요. |
| REJECTED / DISPUTED | 실패한 검사 또는 이의를 확인한 뒤 재시도하세요. |
| RETIRED | 작성자가 판매를 종료했습니다. |

작성자 자신의 검증은 독립 검증에 포함되지 않습니다.
해시 검사만으로 답변 정확도를 증명할 수 없습니다. 목록에 보이게 하려고 검증 요건을 낮추지 마세요.

## 재검증 또는 이의 제기

호환 런타임을 가진 검증자에서 실행합니다.

```bash
ainize patch verify <id>
```

재현 가능한 문제가 있다면 구체적인 이유를 적습니다.

```bash
ainize patch challenge <id> --reason "Describe the reproducible failure"
```

기록은 공개 상태로 남습니다. 이의가 해결될 때까지 판매가 중단될 수 있습니다.

## 새 버전으로 수정

파일이나 벤치마크가 잘못됐다면 별도 ID로 수정 버전을 공개하세요.
충돌을 확인하고 필요한 경우 이전 버전을 명시적으로 대체합니다.
[매일 공개하기](./publish-every-day.md), [외부에서 접근 가능한 노드](./reachable-node.md)를 참고하세요.
