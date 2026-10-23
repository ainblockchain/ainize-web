---
source: en/get-started/install.md
source_sha256: ea5ded66bd3dc8c2b70addbefd3eaf35974416cbf7f408aa94d928427a123041
summary: ainize.ai/code의 AinCode는 CLI·Git·AinDrive가 이미 준비된 작업 공간입니다. 설치할 것이 없습니다.
---

# AinCode 열기

[AinCode](/code)는 ainize.ai의 코딩 작업 공간입니다. Ainize 계정으로 로그인하면 Node.js, Python, Git,
`ainize` CLI가 설치되어 있고 Git이 우리 조직의 AinDrive에 바로 연결된 상태로 열립니다. 따로 설치할 것이
없습니다.

이 문서의 실행 가능한 코드 아래에 있는 **AinCode에서 이 코드 실행**을 누르면, 그 코드의 명령이 셸 모드로
입력창에 들어간 채 작업 공간이 열립니다. Enter를 누르면 실행됩니다.

## 도구 확인

```bash
node --version
ainize --version
ainize --help
```

## 작업 공간에 준비된 것

| | |
|---|---|
| `$AINDRIVE_ORG`, `$AINDRIVE_USER` | 우리 조직의 AinDrive와 내 이름. 문서의 명령이 이 값을 쓰므로 만들어지는 저장소는 내 것입니다. |
| Git | `https://aindrive.ainetwork.ai/<org>/git/<repo>`를 토큰 없이 내 AinDrive 권한으로 clone·push 합니다. 새 이름으로 push 하면 저장소가 만들어집니다. |
| `$AINIZE_API` | 내 계정으로 로그인된 Ainize API: 프로젝트, 배포, 배포 로그. |
| `ainize` | 에이전트와 모델을 호출하는 CLI. |
| `curl`, `jq` | API 응답을 읽는 도구. |

작업 공간의 에이전트는 기본으로 GLM-5.3-Flash를 씁니다. Qwen3.8-Flash-Next 같은 다른 모델을 쓰려면 모델
선택기(터미널 UI에서는 `/models`)에서 고르세요.

내 컴퓨터에서 노드를 돌리려면 [내 컴퓨터에 CLI 설치](../node/install.md)를 보세요.

다음: [빠른 시작](./quickstart.md).
