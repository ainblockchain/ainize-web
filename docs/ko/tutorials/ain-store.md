---
title: "AIN Store: 무엇이고 어떻게 운영하나"
summary: AIN Store는 ainize 앱의 문서 데이터베이스입니다. 데이터가 어디에 저장되는지, 앱용 Store를 세우는 법, 코드를 연결하는 법, Firestore 데이터를 옮기는 법, 그리고 일상 관리·백업·복구를 설명합니다.
source: en/tutorials/ain-store.md
source_sha256: 5b71e73cbb1428d2099d304ede7215b0e5386fb1f4c90db579d949ccbfc4610c
---

# AIN Store: 무엇이고 어떻게 운영하나

AIN Store는 ainize 앱의 문서 데이터베이스입니다. 코드는 컬렉션 안의 문서를 읽고 쓰고, 질의하고, 실시간으로 구독합니다. 이미 Firestore를 쓰던 앱은 `@ainize/firestore-compat`으로 같은 API를 그대로 씁니다. 전체 설계는 [AIN Store 설계](../design/ain-data-platform.md)에 있습니다.

이 튜토리얼을 마치면 데이터의 각 부분이 어디에 있는지 알고, 앱용 Store를 운영하며, 데이터를 읽고·내보내고·바꾸고·모니터링하고·백업하고·다시 만드는 법을 알게 됩니다.

## 1. 데이터는 어디에 있나

Store는 데이터의 종류마다 가장 알맞은 곳에 둡니다.

| 구성요소 | 담는 것 | 다시 만들 수 있나 |
| --- | --- | --- |
| **AinDrive** (조직 드라이브의 `store/<app>/`) | **원본**: 암호화된 모든 문서 본문과 모든 쓰기 기록(`writes/*.jsonl`, 서명된 트랜잭션 포함) | 이것이 원천 |
| **AIN 블록체인** (`/apps/<app>/store/`) | 모든 쓰기에 대한 머클 마운틴 레인지(`mmr`, 데이터 크기와 무관하게 수 KB)와 최신 상태 루트(`state`). 쓰기 규칙과 트리거도 체인에 있음 | 순서와 증명의 원천 |
| **Store 서버** (앱마다 하나) | 체인을 따라가며 쓰기를 적용하고 질의·구독에 응답 | 상태 없음. 재시작·재배포하면 됨 |
| **Postgres** (ainize 관리형 스토어) | Store 서버가 유지하는 질의용 인덱스 | AinDrive + 체인으로 다시 만들 수 있음 (7절) |

이 구조에서 다음이 나옵니다.

- **비공개 컬렉션**(앱 데이터의 기본값)은 체인에 문서 id의 HMAC과 본문의 솔트 해시만 올립니다. AinDrive의 본문은 AES-256-GCM으로 암호화됩니다. 키 없이는 체인에서도 드라이브에서도 데이터를 읽을 수 없습니다.
- **모든 쓰기를 증명할 수 있습니다.** 문서의 현재 버전과 그 버전을 만든 쓰기가 체인에 앵커돼 있음을 Store가 보여 줄 수 있습니다.
- **키가 곧 데이터입니다.** HMAC 키와 암호화 키가 있어야 원본을 읽을 수 있습니다. 비밀 저장소에 두고, 한 대의 기계에만 두지 마세요.

## 2. 앱 설계하기

먼저 세 가지를 정합니다.

1. 체인 위의 **앱 이름**. 예: `<app>` (소문자, 숫자, `_`).
2. **컬렉션.** Firestore의 하위 컬렉션은 평평한 컬렉션이 됩니다. `users/{u}/missions`는 `users__missions`가 되고 문서 id는 `<u>/<mission>` 형태입니다. `firestore-compat`을 쓰는 코드는 여전히 Firestore 경로를 씁니다.
3. 컬렉션마다 **누가 읽고 쓰는지.**
   - **서비스 전용**(백엔드가 모든 쓰기를 함): 가장 단순하고 흔한 경우.
   - **로그인한 사용자**가 AIN SSO 세션 키로 자기 문서를 씀.
   - 남이 읽어야 하는 데이터(점수, NFT 메타데이터)는 **공개** 컬렉션으로 두고 값을 체인에 올릴 수 있음.

이를 `store.config.json`에 적습니다.

```json
{
  "app": "<app>",
  "database": { "urlEnv": "DATABASE_URL" },
  "chain": { "rpcUrl": "https://mainnet-api.ainetwork.ai/json-rpc", "protoVer": "1.6.1", "chainId": 1,
             "startBlock": <앱을 설치하기 직전 블록>, "activationBlock": 1586503 },
  "storage": { "kind": "aindrive", "baseUrl": "https://aindrive.ainetwork.ai", "driveId": "<drive id>",
               "prefix": "store/<app>", "oauth": { "clientId": "<client id>", "refreshTokenEnv": "AINDRIVE_REFRESH_TOKEN" } },
  "collections": {
    "users": { "private": { "hmacKeyEnv": "AIN_STORE_HMAC_KEY", "encryptKeyEnv": "AIN_STORE_ENCRYPT_KEY" }, "read": "none" }
  },
  "state": { "enabled": true, "serviceKeyEnv": "AIN_STORE_SERVICE_KEY" },
  "auth": { "serviceTokenEnv": "AIN_STORE_SERVICE_TOKEN" }
}
```

`read: "none"`은 서비스 토큰을 가진 백엔드만 읽을 수 있다는 뜻입니다. 다른 선택지는 `"public"`, `"auth"`(로그인한 모든 AIN SSO 사용자), `{ "org": "<org>" }`, `{ "ownerField": "<field>" }`입니다.

**확인:** 코드가 쓰는 모든 컬렉션이 목록에 있다.

## 3. 체인에 앱 설치하기

누가 쓸 수 있는지는 체인이 강제합니다. 컬렉션마다 소유자 트랜잭션으로 다음을 설치합니다.

- `/apps/<app>/writes/<collection>`의 **쓰기 규칙.** 예: 서비스 전용 컬렉션이면 서비스 주소만 허용(`@ainize/store-core`의 `compileServiceOnlyRule`), 사용자 쓰기면 세션 규칙(`compileSessionRule`).
- `/apps/<app>/writes/<collection>/$key`의 **`_storeAppend` 함수.** 같은 트랜잭션 안에서 각 쓰기를 앱의 MMR에 접어 넣습니다.
- `/apps/<app>/store/state`의 작성자로 Store 서비스 계정.

**확인:** 첫 쓰기 전에는 `/apps/<app>/store/mmr`의 `ain_get`이 `null`, 쓰기 후에는 `{ n, peaks }`를 돌려준다.

## 4. ainize에서 Store 실행하기

Store는 관리형 Postgres가 연결된 ainize 프로젝트(kind `service`)입니다.

1. **Storage** 탭에서 조직의 Postgres 스토어를 만들고 Store 프로젝트에 **연결**합니다. 컨테이너가 `DATABASE_URL`을 받습니다.
2. 프로젝트 저장소에 `ainize.json`, Store `Dockerfile`, `store.config.json`을 둡니다. `ainize.json`은 `"storage": [{ "name": "db", "kind": "postgres" }]`와, 배포마다 스키마를 만드는 `release` 명령을 선언합니다.
3. 프로젝트 **시크릿**을 설정합니다.

   | 시크릿 | 용도 |
   | --- | --- |
   | `AIN_STORE_SERVICE_KEY` | 상태 게시와 서비스 쓰기 서명 |
   | `AIN_STORE_SERVICE_TOKEN` | 백엔드가 쓰는 bearer 토큰 |
   | `AIN_STORE_HMAC_KEY`, `AIN_STORE_ENCRYPT_KEY` | 비공개 id와 본문 암호화 |
   | `AIN_STORE_TOKEN_KEY` | 저장된 AinDrive 토큰 암호화 |
   | `AINDRIVE_REFRESH_TOKEN` | 드라이브에 대한 AinDrive OAuth 권한(한 번만 넣으면 Store가 DB 안에서 교체해 감) |

4. AinDrive에 push합니다. ainize가 빌드·배포하고, 준비 상태는 `/healthz`로 판단합니다.

**확인:** `GET /healthz`가 `{"ok":true,"ready":true,"alert":null}`을 돌려준다.

## 5. 앱 연결하기

백엔드에 연결 정보를 줍니다(시크릿 `AIN_STORE_CONFIG_B64`, 또는 파일 경로 `AIN_STORE_CONFIG`).

```json
{ "url": "https://<store host>", "app": "<app>", "chainId": 1,
  "writerKey": "<service writer key>", "serviceToken": "<service token>",
  "privateCollections": ["users", "users__missions"], "hmacKey": "<hmac key>" }
```

Firestore로 작성된 코드라면 초기화 부분만 바꿉니다.

```js
const compat = require('@ainize/firestore-compat');
const db = compat.createFirestore(compat.readConnection());
const { FieldValue } = compat;

await db.collection('users').doc(uid).set({ points: 0 }, { merge: true });
const top = await db.collection('users').orderBy('points', 'desc').limit(10).get();
```

새 코드는 `@ainize/store`를 바로 써도 됩니다(`createStore`, `collection`, `doc`, `where`, `orderBy`, `onSnapshot`, `batch`).

코드에 Firebase로 돌아가는 경로를 남기지 마세요. Store 연결이 없으면 서버가 뜨지 않아야, 잘못된 배포가 엉뚱한 곳에 쓰지 않고 바로 드러납니다.

**확인:** 백엔드에서 읽기 한 번, 쓰기 한 번이 성공하고, 그 쓰기가 `/v1/status`에 적용됨으로 보인다.

## 6. Firestore 데이터 옮기기

`@ainize/firestore-compat`의 `firestore-import` 도구는 Firestore 관리형 export(또는 JSONL 덤프)를 읽어 Store로 씁니다.

```bash
firestore-import plan    --export <export 폴더>                       # 컬렉션 구성 제안
firestore-import migrate --export <export 폴더> --transform <rewrite.mjs>
firestore-import verify  --export <export 폴더> --report verify.json  # 개수와 문서별 해시 비교
```

- `--transform`은 들어오는 문서를 바꿉니다. 예: 예전 스토리지 URL을 새 위치로.
- 앱이 Store로 넘어가기 **전에** 가져오세요. 전환 후에는 실제 데이터 위로 `migrate`를 다시 돌리지 마세요. 더 새로운 값 위에 export 값을 덮어씁니다. 남은 것은 이미 있는 문서를 건너뛰는 방식으로만 가져오세요.

**확인:** `verify`가 누락 0건, 불일치 0건을 보고한다.

## 7. 일상 관리

**상태 확인**

```bash
curl https://<store host>/healthz                                         # ok, ready, alert, applied, ingested
curl -H "Authorization: Bearer $TOKEN" https://<store host>/v1/status     # 커서, MMR, 막힌 문서, 모니터
```

Store는 시작 직후 따라잡는 동안과 경보가 있을 때(예: MMR이 체인과 다름) 읽기를 멈춥니다(503). `monitor.webhookUrlEnv`를 설정하면 경보를 받습니다.

**읽기·내보내기**

```bash
curl -X POST https://<store host>/v1/query -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"collection":"users","limit":100}'
```

`nextCursor`로 넘기며 컬렉션 전체를 내보낼 수 있습니다. 비공개 문서는 복호화된 상태로, 원래 id와 함께 나옵니다. 내보낸 파일에는 사용자 데이터가 있으니 그에 맞게 다루세요.

**쓰기**

- 쓰기는 체인 확정을 기다려 몇 초 걸립니다. 관련된 쓰기는 묶고, 요청 처리 안에서 긴 순차 루프는 피하세요.
- writer 키 하나로 체인에 동시에 대기시킬 수 있는 트랜잭션 수에는 한도가 있습니다. 같은 키로 대량 스크립트를 여러 개 동시에 돌리지 마세요.
- 현재는 batch 안의 문서가 각각 따로 판정됩니다. 이 페이지에 바뀌었다고 적기 전까지는, 값을 옮기는 작업에서 여러 문서에 걸친 batch·트랜잭션이 전부 성공하거나 전부 실패한다고 가정하지 마세요.

**운영**

- 쓰기를 처리하는 Store 인스턴스는 한 번에 하나뿐입니다(리더 락). 나머지는 읽기를 처리하다 리더가 멈추면 이어받습니다.
- 재시작하면 읽기 전에 체인과 다시 대조하므로, 큰 앱은 수 분이 걸립니다. 재배포는 습관이 아니라 필요할 때만 하세요.
- ainize 프로젝트 컨테이너에 `docker restart`를 하지 마세요. push로 재배포합니다.

## 8. 백업과 복구

- **원본**은 AinDrive(본문과 쓰기 기록)에 있고 체인에 앵커돼 있습니다. 이것이 백업입니다.
- **Postgres**는 인덱스입니다. 빠른 복구를 위해 백업하되(관리형 스토어는 매일 백업), 언제든 다시 만들 수 있습니다.

```bash
ain-store rebuild --config store.config.json --out rebuilt.db
```

rebuild는 AinDrive의 모든 쓰기 기록을 다시 재생하면서 각각을 서명된 트랜잭션과 대조하고, 결과를 체인의 MMR·상태 루트와 비교합니다.

- **키**(`AIN_STORE_HMAC_KEY`, `AIN_STORE_ENCRYPT_KEY`, 서비스 키)는 다시 만들 수 없습니다. 잃으면 비공개 본문은 영원히 암호화된 채로 남습니다. 조직의 비밀 저장소에 두고 최소 두 사람이 접근할 수 있게 하세요. 암호화 키를 바꿀 때는 새 `encryptKeyEnv`를 설정하고 이전 키를 `previousEncryptKeyEnvs`에 남깁니다.

## 9. Store 담당자 체크리스트

- [ ] 키가 조직의 비밀 저장소에 있고, 두 사람이 접근할 수 있다.
- [ ] 경보가 누군가 보는 채널로 간다.
- [ ] 앱 백엔드에 다른 DB로 돌아가는 경로가 없다.
- [ ] 대량 스크립트는 한 번에 하나만 돌리고, 실제 데이터 위로 다시 가져오지 않는다.
- [ ] 원본이 드라이브의 `store/<app>/`에 있다는 것을 안다.
