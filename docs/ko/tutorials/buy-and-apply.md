---
source: en/tutorials/buy-and-apply.md
source_sha256: baac59762ebf19be068902546762aeba8c152d652d079b50dd35987b6365cb78
---

# 다른 사람이 공개한 지식 사용하기

실행 중인 노드와 운영자 세션(`ainize login --node-key`)이 필요합니다. 지식 적용에는 호환 런타임도 필요합니다.
[빠른 시작](../get-started/quickstart.md)을 참고하세요.

## 찾고 확인하기

```bash
ainize patch ls --status VERIFIED --q office
ainize patch get <id>
ainize patch records <id>
```

노드가 반환한 실제 ID를 사용하세요. 모델·라이선스·부모 지식·가격·검증 기록을 확인합니다.
무결성 검증만으로 답변 정확도가 측정되지는 않습니다.

## 먼저 테스트하기

```bash
ainize chat --list
ainize chat <id> "질문"
```

노드에 파일이 있고 패치 훅이 동작해야 합니다. 브라우저 라이브 테스트는 노드의 무료 한도 내에서
제공되며 지식 구매와는 별개입니다.

## 구매와 적용

```bash
ainize use <id>
ainize wallet
ainize patch stack
```

견적을 확인한 뒤 승인합니다. 판매 가능한 검증된 지식만 구매할 수 있으며,
필요한 부모 지식이 없으면 견적에 함께 포함됩니다. 실행 중인 모델을 변경하지 않고 파일만 받으려면:

```bash
ainize use <id> --no-apply
```

## 중간 실패 복구

결제·다운로드·적용은 각각의 단계입니다. 뒤 단계가 실패해도 구매가 취소되지는 않습니다.

```bash
ainize purchases
ainize logs --kind buy
ainize patch download <id>
ainize patch apply <id>
```

`download`는 기존 구매를 복구합니다. 수동으로 다시 결제하지 마세요.
부모 순서와 해제는 [여러 지식 적용](../how-to/load-several.md), 검증 의미는
[검증](../concepts/verification.md)을 참고하세요.
