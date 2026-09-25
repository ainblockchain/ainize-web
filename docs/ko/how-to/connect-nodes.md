---
source: en/how-to/connect-nodes.md
source_sha256: cade99840a78913fafa6afd1dc3d325c50ad5856283013db74e6de6ea2806844
---

# 지갑에 노드 연결

[Ainize](/signing)에 MetaMask 또는 호환 지갑으로 로그인하세요. 특정 주소만 사용할 수 있는 제한은 없습니다.

## 노드 연결

새 로그인 방식의 npm 릴리스 전에는 최신 CLI 소스를 설치하세요.

```bash
git clone https://github.com/ainblockchain/ainize-cli.git
cd ainize-cli
npm ci
npm install -g .
ainize init --home ~/.ainize-a --name node-a --port 3402
ainize login --home ~/.ainize-a
ainize start --home ~/.ainize-a -d
```

`login`이 웹사이트를 엽니다. 이미 로그인했다면 해당 지갑으로 노드 연결을 승인하세요. 로그인 전이라면 로그인 후 승인 화면으로 돌아옵니다. SSH처럼 브라우저를 열 수 없는 환경에서는 출력된 링크를 직접 여세요. `--no-open`은 링크만 출력합니다.

[내 노드](/my-nodes)에서 연결을 확인할 수 있습니다. CLI로 실행한 노드는 매분 상태를 알립니다. 연결은 상태 보고만 허용하며, 지갑 자산 사용이나 계정 대행 권한을 주지 않습니다.

## 여러 노드 연결

홈 디렉터리와 포트를 다르게 지정하고 같은 지갑으로 승인하세요.

```bash
ainize init --home ~/.ainize-b --name node-b --port 3403
ainize login --home ~/.ainize-b
ainize start --home ~/.ainize-b -d
```

내 노드에서 개별 연결을 해제할 수 있습니다. 연결 해제는 실행 중인 프로세스를 중지하지 않습니다. 중지는 `ainize stop --home ~/.ainize-b`로 실행하세요.

## 로컬 운영 명령

자기 노드의 운영자 명령에는 `ainize login --node-key --home ~/.ainize-a`를 사용합니다. 웹사이트 연결과 로컬 운영 로그인을 구분합니다. `--device`는 CLI 계정 대행을 명시적으로 요청하는 기존 방식이며, 승인 화면에서 권한을 확인할 수 있습니다.
