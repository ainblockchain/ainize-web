---
source: en/get-started/install.md
source_sha256: 1a675eb5547c515877ba04dba0413c07e7cc7db3c775828933ba9348f4806f34
---

# 설치

## 웹의 AinCode에서

Ainize 계정으로 [AinCode](/code)를 열고 본인의 AinDrive 실습 저장소를 선택하세요. 작업 공간에는 Node.js와 CLI가 이미 설치되어 있습니다. 제공된 도구를 확인한 뒤 [빠른 시작](./quickstart.md)으로 이어갑니다.

```bash
node --version
ainize --version
ainize --help
```

AinCode 작업 공간은 게이트웨이를 통해 Ainize에 연결됩니다. 패키지 다운로드와 공개 Git 저장소 복제에는 별도의 준비 경로가 필요하므로, 아래 로컬 설치·CLI 개발 명령은 이 작업 공간에서 그대로 실행되지 않습니다. 실습 파일과 진행 기록은 선택한 AinDrive Git 저장소에 보관하세요.

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
