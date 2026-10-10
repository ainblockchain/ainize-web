---
title: ainize.json으로 리포 배포하기
summary: git 리포 루트의 파일 하나가 push마다 Ainize가 무엇을 실행할지 — Next.js 앱, 단순 스크립트, Dockerfile 서비스, A2A 에이전트 — 와 결과가 어디서 열리는지를 정합니다.
source: en/how-to/deploy-with-ainize-json.md
source_sha256: 6b50894f47dee063499380805884d881d0c24d86d03cf48fc6b853f69b0bdb43
---

# ainize.json으로 리포 배포하기

Ainize의 프로젝트는 git 리포 하나와 파일 하나, 리포 루트의 `ainize.json`입니다. push하면 노드가 그 파일을 읽고,
적힌 대로 빌드해 격리된 샌드박스에서 실행하고, **배포(deployment)** 한 건을 기록합니다(`queued → building →
ready` 또는 `error`, 로그와 URL 포함). 서버 쪽에 따로 설정하는 것은 없습니다. `vercel.json`을 써 봤다면 같은
발상에 두 가지가 더해진 것입니다: 리포가 push마다 한 번 돌고 끝나는 **단순 스크립트**일 수 있고, **A2A URL로 공개되는
에이전트**일 수 있습니다.

리포 자체는 git 리모트가 있는 곳에 있으면 됩니다. 가장 잘 맞는 경우는 [aindrive](https://aindrive.ainetwork.ai)
드라이브 안의 리포 — `https://aindrive.ainetwork.ai/<org>/git/<repo>` — 입니다. 드라이브와 Ainize가 AIN SSO를
공유하므로 push할 수 있는 사람이 곧 배포할 수 있는 사람이고, 드라이브의 파일 화면이 커밋 옆에 그 배포를 보여 줍니다.

## 파일

```json
{
  "name": "clef-artwork-search",
  "kind": "script",
  "runtime": "python3.11",
  "entry": "art_search.py",
  "env": { "AINIZE_DECIDE_URL": "https://ainize.ai/api/decide" },
  "timeoutMs": 120000
}
```

| 키 | 적용 | 뜻 |
|---|---|---|
| `name` | 전체 | 표시 이름. 기본은 리포 이름. |
| `kind` | 전체 | `nextjs`(`package.json`에 `next`가 있으면 기본), `script`, `service`, `agent`. |
| `runtime` | `script` | `python3.11` 또는 `node20`. 기본은 entry 확장자로 정해짐. |
| `entry` | `script` | 실행할 파일, 리포 루트 기준. |
| `env` | 전체 | 빌드와 실행에 들어가는 환경변수. **비밀값 금지** — 파일이 리포에 있습니다. |
| `inputs` | 전체(`script` 실행에서 사용) | 실행 전에 사람이 정하는 매개변수. GitHub Actions `workflow_dispatch` inputs와 같은 모양이며, `INPUT_<NAME>` 환경변수로 전달됩니다. [Inputs](#inputs) 참고. |
| `timeoutMs` | `script` | 실행 1회의 제한 시간. 기본 120 000, 최대 300 000. |
| `build.dockerfile`, `build.context` | `service` | 이미지를 만들 Dockerfile. 기본 `Dockerfile`, `.`. |
| `port` | `nextjs`, `service` | 컨테이너가 듣는 포트. Next.js 기본 3000. |
| `healthcheck` | `nextjs`, `service` | 200이 올 때까지 폴링하는 경로. 응답하면 배포가 `ready`. 기본 `/`. |
| `agent` | `agent` | `{ name, description, model, a2ui }` — 공개될 에이전트 카드의 항목. |

**`ainize.json`이 없는** 리포는 Next.js 앱(`package.json`의 `next` 의존성)일 때만 배포되고, 그 외는 `error: no
ainize.json`으로 끝납니다. 파일이 계약입니다 — 그 기본값 하나 말고는 아무것도 추측하지 않습니다.

## kind별 동작

**`nextjs`** — `node20` 컨테이너에서 빌드(`npm ci && npm run build`)하고 `port`에서 시작(`npm start`)한 뒤,
`healthcheck`가 응답하면 노드의 공개 URL 아래로 노출합니다. 새 배포가 건강해질 때까지 이전 배포가 계속 서빙하고, 그
다음 교체됩니다. Vercel과 같은 모양의 경우입니다.

**`script`** — Ainize에만 있는 경우입니다. push마다 노드가 `entry`를 읽기 전용 샌드박스에서 한 번 실행합니다. 64 MiB
`/work`, 메모리 512 MB, CPU 1개, 그리고 **Ainize 자신 외에는 네트워크 없음**(노드 게이트웨이를 통한 `/api/decide`,
`/api/chat`, `/v1/*`). 표준 출력·표준 에러·종료 코드가 배포 로그가 되고, 종료 코드 0이면 `ready`, 그 외는 `error`입니다.
예시, 평가, 코드가 바뀔 때마다 다시 돌아 기록을 남겨야 하는 것에 쓰세요. 샌드박스 이미지에는 표준 라이브러리와
`requests`가 있고, 그 밖의 의존성은 선언할 수 없습니다.

**`service`** — 리포의 `Dockerfile`을 빌드하고, hosted agent와 같은 격리(내부 네트워크, 게이트웨이를 통한 egress만,
capability 제거, 자원 제한)로 실행한 뒤, `port`의 `healthcheck`를 기다려 노드의 공개 URL 아래로 노출합니다. 무중단
교체입니다.

**`agent`** — 리포를 [hosted agent](./host-an-agent.md)로 빌드해 노드의 A2A 주소 `https://<node>/agents/<id>`에
공개합니다. 에이전트 카드는 파일의 `agent` 항목으로 만들어집니다. A2A를 말하는 무엇이든 그 URL로 호출할 수 있고,
마켓플레이스에도 다른 에이전트처럼 올라갑니다. 에이전트는 노드의 hosted-agent 런타임 이미지로 실행되며(그 이미지가 A2A 계약), 이 kind에서는 리포의 `Dockerfile`을 무시합니다.

## Inputs

`inputs`는 실행 전에 사람이 정할 수 있는 값을 선언합니다. 모양은 **GitHub Actions `workflow_dispatch` inputs와
같습니다** — 이름 아래에 `description`, `type`(`string`, `choice`, `boolean`, `number`; 기본 `string`), `required`,
`default`, 그리고 `choice`의 `options`:

```json
"inputs": {
  "DESC":  { "description": "작품 묘사 (description)", "type": "string", "required": true,
             "default": "해질녘 바다 위 작은 배 한 척, 주황빛 노을, 고요하고 쓸쓸한 분위기의 유화" },
  "MODEL": { "description": "모델", "type": "choice", "options": ["clef-flash", "clef"], "default": "clef-flash" }
}
```

각 입력은 프로그램에 **`INPUT_<NAME>`** 환경변수로 들어갑니다(이름은 대문자로: `INPUT_DESC`, `INPUT_MODEL`;
boolean은 `true`/`false`, number는 십진 문자열). aindrive에서는 리포의 Run 패널이 입력마다 필드 하나 — 텍스트, 선택,
체크박스, 숫자 — 를 `default`로 채워 보여 주고, 그 리포에서 마지막으로 쓴 값을 브라우저에 기억하며, 실행할 때 함께
보냅니다. push 배포는 기본값으로 실행됩니다. 입력은 최대 16개, 이름은 환경변수 이름 규칙, 값은 2 KiB까지입니다.

## push에서 배포까지

1. 프로젝트의 브랜치(기본 `main`)에 push합니다. 리포가 aindrive 드라이브 안에 있으면 첫 push에서 드라이브가 리포를
   바인딩하고(아래 참고) `git-receive-pack`이 성공하는 즉시 프로젝트의 웹훅을 호출합니다. 다른 호스트라면 같은 서명
   본문으로 `POST /api/projects/{id}/hook`을 부르면 됩니다.
2. 노드가 **그 커밋**을 clone해 `ainize.json`을 읽고, push 한 번에 배포 한 건을 프로젝트별 순서대로 큐에 넣습니다.
3. 지켜봅니다: `GET /api/projects/{id}/deployments`가 목록을, `GET /api/deployments/{id}/log`가 실행 중엔 로그를
   스트리밍하고 끝나면 전체를 돌려줍니다. aindrive에서는 리포 폴더가 같은 행을 보여 줍니다 — 빌드 중엔 회색 점이
   깜빡이고, ready면 녹색, error면 빨강 — 커밋마다 *Inspect*(로그)와 *Visit*(URL) 링크가 붙습니다.

## 바인딩은 push가 합니다

aindrive 드라이브 안의 리포에는 바인딩 단계가 없습니다. 루트에 `ainize.json`이 있는 리포를 처음 push하면 프로젝트가
만들어집니다: aindrive가 자기 자신으로서 Ainize에 push를 알리고(`POST /api/projects/auto`, AIN SSO 머신 토큰),
프로젝트의 일회성 웹훅 시크릿을 리포 옆에 저장한 뒤, 바로 그 push에 대해 훅을 호출합니다 — 그러니 **리포에
`ainize.json`이 있다는 건 배포된다는 것**입니다. aindrive의 리포 폴더는 그때까지 "다음 push에서 자동 배포됩니다"를,
그 뒤로는 배포 행을 보여 줍니다. 프로젝트는 push한 사람(AIN 계정)의 것이고, 드라이브는 Ainize 앱이 할당된 AIN 조직에
공유되어 있어야 합니다.

다른 곳에 호스팅된 리포라면 프로젝트를 직접 만들고 그 호스트에서 훅을 호출하세요:

```bash
curl -X POST https://ainize.ai/api/projects \
  -H 'authorization: Bearer <your key>' -H 'content-type: application/json' \
  -d '{"repo":"https://aindrive.ainetwork.ai/comcom/git/clef-artwork-search","branch":"main"}'
```

응답에 프로젝트 id와 **한 번만 보여 주는** `webhookSecret`이 담깁니다. kind·entry·runtime은 어느 경로에도 들어가지
않습니다 — push마다 `ainize.json`에서 읽으므로, 리포가 배포되는 방식을 바꾸는 일은 설정 변경이 아니라 커밋입니다.

## 완전한 예

[`clef-artwork-search`](https://aindrive.ainetwork.ai/comcom/git/clef-artwork-search)는 `script` 프로젝트입니다.
Clef 결정 모델로 묘사에 맞는 작품을 랭킹하는 파이썬 파일 셋, 위의 `ainize.json`, 그리고 같은 것을 다른 곳에서 돌리기
위한 `Dockerfile`로 되어 있습니다. push마다 `art_search.py`가 라이브 모델을 상대로 다시 돌고, 랭킹이 배포 로그에 남습니다.

## 알아둘 제한

- `script` 실행 1회는 최대 32개 파일, 2 MiB 소스. `.git`, `node_modules`, 바이너리는 보내지 않습니다.
- 동시 실행은 호출자당 2개, 노드당 8개. 나머지는 대기하거나 `429`를 받습니다.
- 샌드박스는 Ainize에만 닿습니다. `https://example.com`을 가져오는 스크립트는 실패합니다 — 데이터는 리포에 넣거나
  Ainize 에이전트 뒤에 두세요.
- `env`는 리포와 함께 커밋됩니다. 키와 토큰은 노드의 비밀 저장소([hosted agents](./host-an-agent.md) 참고)에, 절대
  `ainize.json`에 넣지 마세요.
