---
title: 스크립트를 스케줄로, 블록체인 쓰기로, 웹훅으로 실행하기
summary: 스크립트 프로젝트의 ainize.json에 triggers 키를 더하면 노드가 알아서 돌립니다 — cron 스케줄로, AIN 블록체인의 경로가 쓰일 때, 웹훅 URL이 호출될 때. 이벤트는 AINIZE_TRIGGER_EVENT로 들어옵니다.
source: en/how-to/run-scripts-on-a-schedule.md
source_sha256: 110de9b1032999b947ceb256fc2f75c429297792c274fedda21fd0b397dc3a6a
---

# 스크립트를 스케줄로, 블록체인 쓰기로, 웹훅으로 실행하기

`kind: script` 프로젝트는 [실행(Run)](../concepts/deployments-and-runs.md)입니다. 노드가 push마다, 그리고 **실행**
버튼을 누를 때마다 entry를 한 번 돌립니다. 이 페이지는 아무도 누르지 않아도 실행이 시작되는 세 가지 방법 —
**트리거** — 를 더합니다. 같은 `ainize.json`에 선언합니다. Cloud Scheduler, Firestore 트리거, HTTP 트리거 함수가
스크립트 옆 파일 하나에 들어간다고 생각하면 됩니다.

한 번 이상 배포된 스크립트 프로젝트가 필요합니다. 트리거는 그것을 선언한 커밋의 배포가 `ready`가 될 때 설치됩니다.
다른 kind(`nextjs`, `service`, `agent`)는 이 키를 분명한 메시지와 함께 거절합니다.

## `triggers` 키

```json
{
  "kind": "script",
  "entry": "check.py",
  "inputs": { "SEASON": { "type": "number", "default": 1 } },
  "triggers": {
    "hourly":   { "type": "schedule", "cron": "0 * * * *", "timezone": "Etc/UTC", "inputs": { "SEASON": 2 } },
    "on-post":  { "type": "ain", "path": "/apps/afan/posts/$post_id", "inputs": { "POST": "$event.params.post_id" } },
    "webhook":  { "type": "http" }
  }
}
```

`triggers`는 최대 **8개** 항목의 객체입니다. 이름은 `^[a-z0-9][a-z0-9-]{0,31}$`이고, 콘솔·실행 기록·이벤트가 트리거를
부르는 이름이 됩니다. 각 항목은 `{ "type", … }`이고 엄격하게 검사됩니다. 모르는 키는 배포 때 거절되므로 오타가
조용히 아무것도 설치하지 않는 일은 없습니다.

| `type` | 키 | 실행을 시작시키는 것 |
|---|---|---|
| `schedule` | `cron`(5칸 crontab), `timezone`(IANA, 기본 `Etc/UTC`), 선택 `inputs`, 선택 `entry` | 시계. 노드가 30초마다 확인해 다음 시각이 지난 스케줄마다 실행을 하나 시작합니다. |
| `ain` | `path`(AIN DB 경로 패턴: `/` + 세그먼트, `$name` 변수 가능, 256자 이하), 선택 `inputs`, 선택 `entry` | AIN 블록체인의 그 경로에 일어나는 쓰기. 거기에 둔 `_function` REST 규칙을 통해서(아래). |
| `http` | 선택 `inputs`, 선택 `entry` | 트리거의 호출 URL에 토큰과 함께 오는 `POST`. |

`inputs`는 그 트리거에 대한 매니페스트 [inputs](./deploy-with-ainize-json.md#inputs)의 답이고, 값 규칙은 패널에서
실행할 때와 같습니다. `ain` 트리거의 값은 이벤트를 참조할 수 있고 — `$event.params.<이름>`, `$event.value`,
`$event.path`, `$event.timestamp`, `$event.auth.addr` — `http` 트리거의 값은 `$event.body.<키>`와
`$event.query.<키>`를 참조할 수 있습니다. `entry`는 프로젝트 기본값과 다른 파일을 돌립니다.

## 스크립트가 받는 것

트리거로 시작된 실행에는 평소의 `INPUT_*`, `AINIZE_URL`, `AINIZE_API_KEY` 옆에 환경변수 셋이 더 들어옵니다.

| 변수 | 값 |
|---|---|
| `AINIZE_TRIGGER` | 트리거 이름 (`hourly`, `on-post`, `webhook`) |
| `AINIZE_TRIGGER_TYPE` | `schedule`, `ain`, `http` 중 하나 |
| `AINIZE_TRIGGER_EVENT` | 이벤트 JSON, 최대 64 KiB (더 크면 실행이 `event_too_large`로 실패) |

이벤트 모양은 type에 따라 다릅니다.

```json
{ "type": "schedule", "name": "hourly", "firedAt": 1761800400123, "scheduled": 1761800400000 }
```

```json
{
  "type": "ain", "name": "on-post",
  "path": "/apps/afan/posts/p_42", "params": { "post_id": "p_42" },
  "value": { "title": "hello" }, "prevValue": null,
  "timestamp": 1761800400000, "auth": { "addr": "0xabc…" }, "txHash": "0x…",
  "raw": { "…AIN 블록체인 REST _function 호출이 POST한 본문 그대로…" }
}
```

```json
{
  "type": "http", "name": "webhook", "method": "POST",
  "query": { "dry": "1" }, "headers": { "content-type": "application/json" },
  "body": { "order": 17 }
}
```

읽는 건 한 줄입니다.

```python
import json, os
event = json.loads(os.environ.get("AINIZE_TRIGGER_EVENT", "{}"))
if event.get("type") == "ain":
    print("post", event["params"]["post_id"], "written by", event["auth"]["addr"])
```

패널이나 push로 시작된 실행에는 `AINIZE_TRIGGER*` 변수가 아예 없으므로 같은 스크립트가 양쪽을 다 섬깁니다. 콘솔의
**지금 실행**은 가짜 이벤트 `{ "type": "manual" }`을 보냅니다.

## 스케줄

`"cron": "0 9 * * 1-5"`에 `"timezone": "Asia/Seoul"`이면 평일 서울 시간 09:00에 돕니다. 이전 실행이 아직 `queued`나
`building`이면 스케줄은 두 번째 실행을 쌓지 않습니다 — 그 시각은 건너뛰고 로그에 남깁니다. 밀린 것을 따라잡지도
않습니다. 노드가 꺼져 있다 돌아오면 스케줄마다 많아야 한 번 돌고 다음 미래 시각으로 넘어갑니다. 실행은 활성 배포를
push한 사람의 이름으로 만들어지므로 그 사람의 `AINIZE_API_KEY`를 씁니다.

## 웹훅

`http` 트리거에는 **호출 URL** `POST /api/projects/<id>/triggers/<name>/fire`과, 설치될 때 발급되어 한 번만 보여 주는
**토큰**이 있습니다. 콘솔의 **토큰 재발급**이 새 토큰을 만듭니다. 토큰은 `Authorization: Bearer <토큰>`으로(헤더를 못
붙이는 호출자는 `?token=`으로) 보냅니다. 본문(64 KiB 이하, JSON이나 텍스트)이 이벤트의 `body`가 됩니다. 응답은
`202 { "runId", "status" }`, `401`은 틀린 토큰, `409 trigger_disabled`는 꺼진 트리거, `429`는 한 트리거에 분당 60회를
넘긴 경우입니다.

```bash
curl -X POST "https://ainize.ai/api/projects/<id>/triggers/webhook/fire" \
  -H "authorization: Bearer <token>" -H "content-type: application/json" \
  -d '{"order": 17}'
```

## AIN 블록체인 트리거

`ain` 트리거는 AIN 블록체인 위의 Firestore 트리거 모델입니다. 데이터베이스 경로에 규칙을 두면 그 경로가 쓰일 때마다
URL이 호출됩니다. 규칙은 노드가 만들어 줍니다 — 콘솔에서 트리거의 **AIN 규칙 보기** — `path`에 설정할 `.function`
값 그대로입니다.

```json
{
  "ainize-<projectId>-on-post": {
    "function_type": "REST",
    "function_url": "https://ainize.ai/api/projects/<id>/triggers/on-post/fire?token=<token>",
    "function_id": "ainize-<projectId>-on-post"
  }
}
```

`_function` 호출은 헤더를 붙일 수 없어서 토큰이 URL에 실립니다. 노드가 그 경로에 쓸 수 있는 AIN 키를 가졌으면
**체인에 설치**가 대신 설정해 주고(`setFunction`), 아니면 **규칙 복사**로 경로를 소유한 키로 직접 설정하세요. 그 뒤
쓰기마다 위의 `ain` 이벤트가 옵니다. 경로의 `$post_id`는 `params`에, 써진 `value`, 쓴 사람의 주소, 트랜잭션 해시와
함께.

## 콘솔에서

프로젝트의 **실행** 탭은 설치된 트리거를 모두 보여 줍니다. 이름, 종류, cron이나 경로, 다음·마지막 실행(로그로 가는
링크), 켜고 끄는 스위치, **지금 실행**, 그리고 `http`/`ain`에는 호출 URL, **토큰 재발급**, 규칙. 실행 기록은 실행마다
시작시킨 트리거 — *스케줄*, *AIN 트리거*, *웹훅* — 와 그 이름을 표시합니다.

다음 push는 집합을 통째로 바꿉니다. `ainize.json`에서 사라진 이름은 지워지고, 남은 이름은 켜짐/꺼짐과 토큰을 유지합니다.
트리거는 API로도 읽고 — `GET /api/projects/<id>/triggers` — `POST …/triggers/<name>/enable`과 `/disable`로
켜고 끕니다. [HTTP API 레퍼런스](../reference/http-api.md)를 보세요.
