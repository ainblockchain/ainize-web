---
title: 설치
summary: 이 저장소를 받아서 `ainize` 명령을 내 컴퓨터에 올리고, 노드가 자기 자신을 어디에 두는지 익힙니다.
source: en/get-started/install.md
source_sha256: d96e805d0eda5b50a9028e64945f9c4d7807c82450124717c3c302605c309814
---

# 설치

이 페이지를 끝내면 `ainize` 명령 하나와, 그 명령이 노드를 담아 둘 디렉터리 하나가 생깁니다. 여기까지는 GPU도 모델도
필요 없습니다. 그건 다음 페이지의 일입니다. 십 분쯤 걸리고, 대부분은 `npm install`을 기다리는 시간입니다.

> [!NOTE]
> 아래 블록은 모두 실제로 실행한 명령과 그때 찍힌 출력입니다. 손댄 곳은 절대 경로 하나뿐입니다. 기록에 쓴 컴퓨터가
> 작업 디렉터리를 길고 지저분한 자리에 두고 있어서, 노드의 홈 디렉터리는 `<AINIZE_HOME>`으로, 그 옆의 파일은 `~/…`
> 로 줄여 적었습니다. 그 밖에는 바꾼 것도, 지어낸 것도 없습니다.

## 먼저 Node 24

Ainize는 Node 24를 기준으로 쓰였고, 저장소가 그렇게 못 박아 두었습니다. 최상위 `package.json`에
`"engines": { "node": ">=24" }`가 적혀 있고, `packages/` 아래의 모든 작업 공간이 그 Node로 빌드됩니다. 지금 무엇이
깔려 있는지 확인합니다.

```bash
node --version
```

```text
v24.20.0
```

숫자가 이보다 낮으면 먼저 Node 24를 설치하세요. `npm`은 Node에 딸려 오니 따로 받을 것은 없습니다. Node를 시스템 전체가
아니라 홈 디렉터리 아래에 설치했다면, 그 `bin`이 `PATH`에 먼저 올라와 있어야 `node`와 `npm`이 그 사본을 가리킵니다.

```bash
export PATH="$HOME/.local/node/bin:$PATH"
```

## 설치하기

```bash
npm install -g ainize
```

```text
added 206 packages in 1m

46 packages are looking for funding
  run `npm fund` for details
```

```bash
ainize --version
```

```text
0.1.0
```

설치는 이걸로 끝입니다. `ainize`라는 명령 하나가 `PATH`에 올라왔고, 이것이 노드가 실행하는 프로그램이자 사이트가
호출하는 그 프로그램입니다.

지나가는 길에 npm이 설치 스크립트 경고를 냅니다. `secp256k1`, `keccak`, `better-sqlite3`가 네이티브 코드를 빌드하기
때문입니다. 노드가 쓰는 서명·저장 라이브러리들이고, 빌드가 안 되면 더 느린 자바스크립트로 대신 동작하므로 이 경고는
실패가 아닙니다.

> [!NOTE]
> **모노레포를 클론해서 `npm link -w packages/cli` 하라는 안내를 봤다면 그건 오래된 문서입니다.** `ainize`가 게시되기
> 전에는 그 길뿐이었지만, 거기 적힌 작업 공간은 이제 없습니다 — 패키지들은 각자의 저장소로 나뉘었습니다
> ([ainize-cli](https://github.com/ainblockchain/ainize-cli),
> [ainize-node](https://github.com/ainblockchain/ainize-node), [ainize-core](https://github.com/ainblockchain/ainize-core)).
> `ngram`이라는 두 번째 명령을 언급하는 문서도 있을 텐데 그건 예전 이름입니다. 게시된 패키지가 설치하는 명령은
> `ainize` 하나입니다.

## 고쳐 쓸 때만: 소스에서 빌드하기

고칠 생각이 있을 때만 필요합니다. 게시된 패키지도 같은 트리에서 빌드됩니다.

```bash
git clone https://github.com/ainblockchain/ainize-cli
cd ainize-cli
npm install
npm run build
npm link
```

`npm link`는 npm 전역 `bin`에 심볼릭 링크를 만들어 내 체크아웃 안을 가리키게 하므로, 이후 `npm run build`만 하면
재설치 없이 명령이 그 자리에서 갱신됩니다. `npm install -g ainize`가 올려 둔 것을 대체하며, `npm unlink -g ainize &&
npm install -g ainize`로 게시본으로 되돌립니다.

## 노드가 사는 곳: `AINIZE_HOME`

노드는 자기 자신을 디렉터리 하나에 모아 둡니다. 키도, 설정도, 원장도, 가지고 있는 지식도 전부입니다. 그 디렉터리를
가리키는 이름이 `AINIZE_HOME`이고, 비워 두면 `~/.ainize`입니다. 값을 정하면 그 세션 동안 CLI가 말을 거는 노드가
그 노드로 정해집니다.

```bash
export AINIZE_HOME=~/nodes/quickstart
```

디렉터리 하나가 노드 하나입니다. 한 컴퓨터에서 노드를 둘 돌린다는 말은 디렉터리 둘과 포트 둘이라는 뜻이고, 다음
페이지의 기록이 실제로 그렇게 만들어졌습니다. 명령 하나에만 적용하고 싶으면 `--home` 옵션이 같은 일을 합니다
(`ainize --home ~/nodes/other status`). 모든 명령이 이 옵션을 받습니다.

`ainize init`이 디렉터리를 만들고 나면, 그 직후에는 `init`이 직접 쓴 것만 들어 있습니다.

```bash
ls -1 "$AINIZE_HOME"
```

```text
config.json
data
```

나머지는 노드를 쓰면서 하나씩 생깁니다. 그래서 한 번 띄우고 로그인까지 마친 노드에서 같은 명령을 실행하면 항목이
둘이 아니라 다섯입니다.

```text
cli.json
config.json
data
node.log
node.pid
```

| 항목 | 만드는 명령 | 무엇인가 |
|---|---|---|
| `config.json` | `ainize init` | 노드 그 자체입니다. 개인 키와 주소, 포트와 역할, 어느 원장에 쓸지, 가격, 서빙 모델이 어디 있는지가 들어 있습니다. 여기 있는 모든 키는 [설정 레퍼런스](../reference/config.md)에 정리돼 있습니다. |
| `data/` | 노드가 돌면서 | 원장 기록, 가지고 있는 지식의 본문, 데이터셋, 누가 무엇을 샀는지의 기록. |
| `node.log` · `node.pid` | `ainize start --detach` | 백그라운드 노드가 남기는 로그와, `ainize stop`이 그 노드를 다시 찾는 방법. |
| `cli.json` | `ainize login` | 운영자 토큰과, CLI가 말을 거는 노드 주소. 노드의 신원이 아니라서 지웠다 다시 만들어도 됩니다. |

> [!WARNING]
> **`config.json`에는 노드 개인 키의 유일한 사본이 들어 있습니다.** 이 키가 그 노드가 공개한 모든 것과 잔액과 정산을
> 소유합니다. 복구도 초기화도 없습니다. 무엇을 공개하기 전에 먼저 백업하세요.
>
> ```bash
> ainize keys backup ~/node-key.json --passphrase "a long passphrase you can remember"
> ```
>
> ```text
> ✓ node key of quickstart (0x9d9da8f0C939c0cE4909ef44B73BeDffF740e77A) written to ~/node-key.json
>   encrypted (scrypt + aes-256-gcm) — without the passphrase this file is useless, including to you
>   restore it on another machine with `ainize keys import ~/node-key.json`
> ```

## 다음

명령은 갖췄습니다. 다음 페이지는 이 명령으로 노드를 띄우고, 모델을 물리고, 답이 바뀌는 것을 봅니다.
[빠른 시작](./quickstart.md)입니다.

플래그가 무슨 일을 하는지가 궁금한 것이라면 그건 이 사이트의 다른 절반입니다. [CLI 명령 레퍼런스](../reference/cli.md)는
모든 명령과 옵션을, [설정 레퍼런스](../reference/config.md)는 방금 읽은 그 파일을 다룹니다. 둘 다 코드에서 직접
만들어집니다.
