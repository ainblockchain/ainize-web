---
source: en/how-to/reachable-node.md
source_sha256: b972c31f4cfe4b75a743565b3801baffaf2c76f5ac4dd31590225a90fc4db656
---

# 외부에서 접근 가능한 노드 운영

## 바인딩 주소와 공개 주소

TLS 역방향 프록시 뒤에서는 API를 루프백에 바인딩합니다.
`publicUrl`에는 피어가 접근할 HTTPS 주소를 지정하세요. LAN에 직접 바인딩하면 방화벽으로 접근을 제한합니다.

```bash
ainize config set publicUrl https://your-node.example.com
ainize stop
ainize start -d
```

프록시는 `/api`, `/p2p`, `/x402`, `/agents`를 전달하고 인증 헤더와 스트리밍을 유지해야 합니다.
웹 UI는 별도의 Next.js 애플리케이션입니다.

## 피어 연결

```bash
ainize peers add https://ainize.ai
ainize nodes
```

피어의 원장 설정이 호환되어야 합니다. 주소를 배웠다고 연결이 성공한 것은 아닙니다.
다른 머신에 `localhost`를 공개 주소로 알려 주지 마세요.

## 연결 진단

```bash
ainize status --check
ainize logs --kind p2p --limit 10
```

접속 오류·최근 접속 시간·원장 불일치를 확인합니다. 다른 머신에서 공개 API를 테스트하세요.

```bash
curl --fail https://your-node.example.com/api/info
```

## 역할

`seller`는 파일을 제공하고, `serving`은 모델을 사용하며, `verifier`는 다른 사람의 파일을 받아 검증합니다.
운영 가능한 역할만 활성화하세요. [검증자 비용](./run-a-verifier.md)을 참고하세요.

## 백그라운드 실행과 확인

```bash
ainize start -d
ainize status --check --json
ainize stop
```

부팅 시 자동 시작에는 프로세스 관리자를 사용하고 로그 보관 정책을 설정합니다.
신원과 원장을 포함한 홈 디렉터리를 백업하세요.
