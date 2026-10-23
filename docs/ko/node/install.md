---
source: en/node/install.md
source_sha256: 2553e392d753f02c3ccf66e32eb600fc691b0dd21152f5f4a3589b03ed5bec25
summary: 내 컴퓨터에서 노드를 돌리려면 ainize CLI를 설치하거나 소스에서 빌드합니다.
aincode: false
---

# 내 컴퓨터에 CLI 설치

내 노드를 직접 돌릴 때만 필요합니다. 코드를 작성하고 배포하는 데는 아무것도 설치할 필요가 없습니다.
[AinCode](../get-started/install.md)에는 CLI가 이미 들어 있습니다.

## 공개 CLI 설치

Node.js 24 이상이 필요합니다.

```bash
node --version
npm install -g ainize
ainize --help
```

## 소스에서 빌드

CLI를 수정할 때 사용합니다.

```bash
git clone https://github.com/ainblockchain/ainize-cli
cd ainize-cli
npm ci
npm run build
npm link
```

## 노드 파일

`--home` 또는 `AINIZE_HOME`으로 노드 디렉터리를 지정합니다. 기본값은 `~/.ainize`입니다.
노드마다 별도의 디렉터리와 포트를 사용하세요.

| 파일 | 용도 |
|---|---|
| `config.json` | 신원·모델·네트워크 설정. 개인 키가 있으므로 안전하게 백업하세요. |
| `data/` | 원장·데이터셋·지식 파일. |
| `node.log`, `node.pid` | 백그라운드 프로세스 로그와 PID. |
| `cli.json` | CLI 세션. |
| `teaching-key.json` | CLI 수업의 소유 키. 가르치기 전에 백업하세요. |

웹 애플리케이션은 노드와 별도로 배포합니다. [ainize.ai](https://ainize.ai)를 이용하거나
[ainize-web](https://github.com/ainblockchain/ainize-web)을 자신의 노드에 연결하세요.

다음: [로컬 노드 시작하기](./quickstart.md).
