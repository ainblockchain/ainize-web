---
source: en/how-to/connect-nodes.md
source_sha256: 0b576206e004de001875ce9c891033468b2970f044d59a57ce217f630713a1e0
---

# AIN 계정에 노드 연결

[Ainize](/signing)에 AIN 계정(SSO) 또는 호환 지갑으로 로그인하세요. 개인 AinCode 작업 공간에서는 기존 AIN 로그인으로 노드가 계정에 자동 연결됩니다.

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

개인 AinCode에서는 `login --no-open`을 실행하세요. 기존 AIN 로그인을 사용하므로 별도의 Drive 권한이나 지갑 승인이 필요하지 않습니다. AinCode 밖에서는 `login`이 웹사이트를 열며, 로그인 후 노드 연결을 승인합니다. SSH처럼 브라우저를 열 수 없는 환경에서는 출력된 링크를 직접 여세요. `--no-open`은 브라우저를 열지 않습니다.

[내 노드](/my-nodes)에서 연결을 확인할 수 있습니다. CLI로 실행한 노드는 매분 상태를 알립니다. 연결은 상태 보고만 허용하며, 지갑 자산 사용이나 계정 대행 권한을 주지 않습니다.

## 여러 노드 연결

홈 디렉터리와 포트를 다르게 지정하고 같은 계정으로 연결하세요.

```bash
ainize init --home ~/.ainize-b --name node-b --port 3403
ainize login --home ~/.ainize-b
ainize start --home ~/.ainize-b -d
```

내 노드에서 개별 연결을 해제할 수 있습니다. 연결 해제는 실행 중인 프로세스를 중지하지 않습니다. 중지는 `ainize stop --home ~/.ainize-b`로 실행하세요.

## 로컬 운영 명령

자기 노드의 운영자 명령에는 `ainize login --node-key --home ~/.ainize-a`를 사용합니다. 웹사이트 연결과 로컬 운영 로그인을 구분합니다. `--device`는 CLI 계정 대행을 명시적으로 요청하는 기존 방식이며, 승인 화면에서 권한을 확인할 수 있습니다.
