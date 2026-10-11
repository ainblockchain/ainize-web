---
source: en/get-started/install.md
source_sha256: 889fd440e2af16cf009084f27c3a63fde1b50c5f95c7d8e16bb76ff841e64a11
---

# 설치

## 웹의 AinCode에서

Ainize 계정으로 [AinCode](/code)를 열고 본인의 AinDrive 실습 저장소를 선택하세요. 작업 공간에는 Node.js와 CLI가 이미 설치되어 있습니다. 제공된 도구를 확인한 뒤 [빠른 시작](./quickstart.md)으로 이어갑니다.

```bash
node --version
ainize --version
ainize --help
```

준비된 AinCode 실습 환경은 게이트웨이를 통해 패키지 다운로드와 공식 CLI 소스 저장소에 연결됩니다. 아래 소스 빌드에 필요한 도구와 SQLite 바이너리도 기본 환경에 포함되어 있습니다. 실습 파일과 진행 기록은 선택한 AinDrive Git 저장소에 보관하고, 백업으로 사용하기 전에 저장과 복원이 성공하는지 확인하세요.

## 내 컴퓨터에서

Node.js 24 이상에서 공개 CLI 패키지를 설치합니다.

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

다음: [빠른 시작](./quickstart.md).
