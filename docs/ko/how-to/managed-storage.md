---
title: 프로젝트에 데이터베이스와 파일 저장소 연결하기
summary: 조직의 Postgres 또는 S3 호환 Blob 스토어를 만들어 프로젝트에 연결하면, 다음 배포부터 앱이 DATABASE_URL과 S3_*를 받습니다 — 마이그레이션, 데이터 브라우저, AinDrive로의 매일 백업까지.
source: en/how-to/managed-storage.md
source_sha256: 37bd23af5d145916126c8087dcbefc489081afae60bd416f45dfdff9f5f0a2c8
aincode: false
---

# 프로젝트에 데이터베이스와 파일 저장소 연결하기

[ainize.json](./deploy-with-ainize-json.md)으로 배포한 앱은 데이터를 둘 곳이 필요할 때가 많습니다. 인터넷 어딘가의
데이터베이스를 빌려 그 URL을 시크릿에 붙여 넣는 대신, 노드에 요청하세요. **스토어(store)** 는 노드가 앱 옆에서 운영하는
Postgres 16 데이터베이스(pgvector 선택 가능) 또는 S3 호환 **Blob** 버킷이며, 연결한 프로젝트만 닿을 수 있는 내부
네트워크에 있습니다. 스토어는 [조직](./organizations.md)에 속하므로, 한 제품의 백엔드와 웹 프런트가 같은 스토어를 함께 쓸
수 있습니다. Vercel Storage를 써 봤다면 같은 흐름입니다: 스토어를 만들고, 프로젝트를 연결하면, 접속 정보가 환경 변수로
들어옵니다.

스토어는 운영자가 관리형 스토리지를 켠 노드에서 쓸 수 있습니다. 꺼진 노드에서는 Storage 탭이 "이 노드는 관리형 스토리지를
제공하지 않습니다"라고 알리고, 스토리지를 요구하는 배포는 그 한 문장과 함께 실패합니다.

## 스토어 만들기

조직의 **설정 → 스토리지**(조직의 리포 목록에서 **스토리지 →** 로도 이동)를 열고 **스토어 만들기**를 고릅니다:

- **이름** — 소문자, 숫자, 하이픈, 32자까지(`app-db`, `ainteams-files`). `ainize.json`의 항목 이름과 같게 두면 프로젝트의
  Storage 탭이 한 번에 연결합니다. 이름은 앱에서 스토어를 부르는 주소이기도 합니다: `<name>.store.internal`.
- **종류** — *Postgres*(관계형: Prisma, Drizzle, TypeORM …) 또는 *Blob*(S3 API로 다루는 파일과 이미지).
- **엔진** — Postgres 16, Postgres 16 + pgvector, Blob.
- **메모리 / CPU** — 비워 두면 노드 기본값. 대화 상자가 노드의 최대치를 보여 줍니다.
- **백업 시각** — 매일 이 시각(Asia/Seoul)에 백업합니다.

만드는 데 1분쯤 걸립니다. 스토어 페이지가 **만드는 중**, 그다음 **사용 가능**을 보여 줍니다. 스토어는 쓰기 역할 멤버부터
만들 수 있고, 목록은 모든 멤버가 봅니다.

## ainize.json에 선언하고 연결하기

코드가 기대하는 것을 `ainize.json`에 적습니다 — 스토어 이름이면 충분합니다:

```json
{ "kind": "nextjs", "storage": ["app-db"] }
```

또는 종류를 확인받고 접두어를 직접 정하려면:

```json
{
  "kind": "service",
  "port": 4000,
  "storage": [
    { "name": "app-db", "kind": "postgres" },
    { "name": "app-files", "kind": "blob", "env": "FILES", "required": false }
  ]
}
```

그런 다음 프로젝트의 **Storage** 탭을 엽니다. 항목마다 한 줄씩 나오고, 아직 연결되지 않은 항목에는 그렇다는 표시와
**연결** 버튼이 있습니다. 알맞은 종류의 기존 스토어를 고르거나 **새로 만들기**(이름은 항목에서 채워짐)를 고르고,
**연결 후 재배포**를 켜 두면 그 배포가 준비되는 대로 앱이 변수를 받습니다. 스토어 페이지(**개요 → 프로젝트에 연결**)에서도
연결할 수 있습니다.

연결되지 않은 `required` 항목(기본값)이 있으면 **빌드 전에 배포가 실패**하고, 로그에
`storage "app-db" is declared in ainize.json but not connected — connect a store on the project's Storage tab`이 남습니다.
`"required": false`면 배포 로그에 한 줄만 남깁니다. 프로젝트 하나는 스토어를 최대 4개 연결합니다.

## 코드가 받는 것

배포 때 앱 컨테이너가 스토어의 내부 네트워크에 들어가고, 프로젝트 자체의 환경 변수 다음에 아래 변수를 받습니다.
**첫** Postgres 스토어와 **첫** Blob 스토어는 접두어 없는 이름도 받고, 모든 스토어는 접두어 붙은 묶음을 받습니다(`P`가
접두어 — 항목 이름을 대문자로, `-` → `_`, 또는 직접 준 `env`):

| 스토어 | 같은 종류의 첫 스토어 | 모든 스토어 | 값 |
|---|---|---|---|
| Postgres | `DATABASE_URL`, `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_URL_NO_SSL` | `P_DATABASE_URL`, `P_POSTGRES_URL`, … | `postgresql://app:<password>@<name>.store.internal:5432/app?sslmode=disable` |
| | `POSTGRES_PRISMA_URL` | `P_POSTGRES_PRISMA_URL` | 같은 URL에 `&connection_limit=10&pool_timeout=20&connect_timeout=15` |
| | `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`, `POSTGRES_DB` | `P_POSTGRES_HOST`, … | URL의 각 부분 |
| | `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` | — | 이미지 안의 `psql`, `pg_dump`가 그대로 동작 |
| Blob | `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`, `S3_FORCE_PATH_STYLE` | `P_S3_*` | `http://<name>.store.internal:9000`, `app`, 키, 시크릿, `us-east-1`, `true` |
| | `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | — | AWS SDK v3가 스스로 읽음 |
| | `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `MINIO_USE_SSL` | `P_MINIO_*` | `<name>.store.internal:9000`(스킴 없음), 키, 시크릿, `app`, `false` |

Storage 탭은 연결된 스토어마다 정확히 이 이름들을 보여 줍니다. TLS도 풀러도 없습니다: 스토어는 연결된 프로젝트만 들어오는
내부 브리지에 있습니다. 앱은 자기 데이터베이스의 소유자인 `app` 역할로 로그인하며, 슈퍼유저로는 절대 들어가지 않습니다.
Blob 스토어에는 비공개 버킷 `app` 하나가 있습니다.

프로젝트에 이미 같은 이름의 환경 변수(예: 외부 `DATABASE_URL`)가 있으면, 연결된 동안에는 스토어 값이 이깁니다: 배포
로그에 `overrides secret DATABASE_URL`이 남고, **설정 → 환경 변수**에서 그 줄은 흐리게 표시되며, 스토어 연결을 해제하기
전에는 거기서 설정할 수 없습니다.

Drizzle을 쓰는 Next.js나 NestJS:

```ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

export const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }));
```

Prisma는 `schema.prisma`에서 `POSTGRES_PRISMA_URL`(또는 `DATABASE_URL`)을 읽습니다:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("POSTGRES_PRISMA_URL")
}
```

AWS SDK v3는 버킷 이름과 경로 방식 주소만 있으면 됩니다:

```ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ forcePathStyle: true });
await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: 'hello.txt', Body: 'hi' }));
```

minio-js는 스킴 없는 엔드포인트를 받습니다. 바꿔 놓을 docker-compose 파일들이 그렇게 넘겼던 대로입니다:

```ts
import { Client } from 'minio';

const [host, port] = process.env.MINIO_ENDPOINT!.split(':');
const minio = new Client({ endPoint: host, port: Number(port), useSSL: false, accessKey: process.env.MINIO_ACCESS_KEY!, secretKey: process.env.MINIO_SECRET_KEY! });
```

노트북에서 스토어를 다루려면, 스토어 카드의 **값 보기**가 1분 동안 값을 보여 주고(쓰기 역할 멤버만; 조회마다 기록됨)
**.env.local 복사**가 전체를 복사합니다. 스토어는 노드의 내부 네트워크에서만 닿으므로, 로컬 작업에는 노드 운영자를 통한
터널이 필요합니다.

## `release`로 마이그레이션 실행하기

`release`는 새 컨테이너가 트래픽을 받기 전에 빌드된 이미지에서 명령을 실행합니다 — 데이터베이스 마이그레이션 자리입니다:

```json
{
  "kind": "service",
  "port": 4000,
  "storage": ["app-db"],
  "release": { "command": ["pnpm", "--filter", "@app/backend", "db:migrate"], "timeoutSeconds": 900 }
}
```

- 앱과 같은 환경 변수와 스토어 네트워크를 쓰고, 루트 파일 시스템은 읽기 전용이며, 밖으로는 프록시로만 나갑니다.
- 0이 아닌 종료 코드나 시간 초과(기본 600초, 최대 1800초)는 **배포를 실패시키고 이전 컨테이너가 계속 서비스합니다**.
  `[release]` 줄이 배포 로그에 남습니다.
- `target`은 Dockerfile의 다른 스테이지를 이 명령용으로 빌드합니다 — `drizzle-kit`이 아직 있는 `builder` 스테이지:
  `{ "target": "builder", "command": ["node_modules/.bin/drizzle-kit", "migrate"] }`. `entrypoint`는 이미지의 것을 바꿉니다.
- `"when": "storage"`면 연결된 스토어가 없을 때 건너뜁니다.
- **배포할 때마다**, 이전 버전이 아직 서비스하는 동안 실행됩니다. 두 번 실행돼도 되는 마이그레이션을 쓰고(`drizzle-kit
  migrate`, `prisma migrate deploy`가 그렇습니다) 스키마는 두 단계로 바꾸세요 — 새 열을 추가하고, 둘 다 쓰는 코드를
  배포한 뒤, 나중에 옛 열을 지웁니다.

## 여러 프로젝트가 스토어 하나 함께 쓰기

스토어 하나를 조직의 여러 프로젝트에 연결할 수 있습니다. 예를 들어 AIN Teams는 백엔드와 웹 프런트를 같은 두 스토어에
두고, 마이그레이션은 백엔드만 합니다:

```json
{ "kind": "service", "port": 4000, "storage": ["ainteams-db", "ainteams-files"], "release": { "command": ["pnpm", "--filter", "@app/backend", "db:migrate"] } }
```

```json
{ "kind": "service", "port": 3000, "storage": ["ainteams-db", "ainteams-files"] }
```

연결할 때 같은 Postgres 스토어 안에 **자기만의 데이터베이스**를 요청할 수도 있습니다(연결할 때의 **데이터베이스** 칸).
기본은 함께 쓰는 `app` 데이터베이스입니다. 한 스토어에 연결된 프로젝트들은 그 네트워크에서 서로 닿을 수 있으니, 스토어는
한 제품의 프로젝트끼리만 나누세요.

## 데이터 보기와 읽기 전용 SQL

스토어 페이지의 **데이터** 탭(쓰기 역할)은 데이터베이스의 테이블과 대략의 행 수를 보여 주고, 테이블 하나의 행을 한
페이지에 50개씩, 아무 열로나 정렬해 보여 줍니다. **SQL 실행**은 읽기 전용 문장 하나 — `SELECT`, 10초, 최대 200행 표시 —
를 별도의 읽기 전용 역할로 실행하므로, 거기에 무엇을 입력해도 데이터는 바뀌지 않습니다. Blob 스토어는 경로별로 객체를
보여 주고 각각 내려받을 수 있습니다.

## 백업, 복원, 되돌리기

모든 스토어는 매일 정한 시각에(또는 매시간, 또는 안 함 — **백업** 탭의 일정) 덤프되고, 확인을 거쳐, 노드의 NAS에
보관됩니다. 조직의 **AinDrive 백업 대상**을 한 번 설정하면(**설정 → 스토리지**, 관리자: 드라이브 ID와 `drives:write`
권한의 AinDrive 계정 토큰 `aind_aat_…`; 노드가 시험 업로드로 확인하고 다시 보여 주지 않음) 백업마다 그 드라이브의
`ainize-storage/<store>-<id>/backups/<date>/` 아래에도 복사되고, 백업을 설명하는 작은 JSON 파일이 함께 놓입니다 — 다른
노드에서도 드라이브만으로 복원할 수 있을 만큼입니다. 2 GiB를 넘는 덤프는 NAS에만 남습니다. 보관은 기본으로 30일, 자동
백업 최대 60개이며, 가장 최근 백업은 언제나 남고, 복원·교체·삭제 전에 남기는 안전 백업은 30일 보관됩니다.

**지금 백업**은 언제든 하나를 만듭니다. 백업의 **복원…**(관리자, 확인을 위해 스토어 이름 입력)은 두 가지를 제공합니다:

- **새 스토어로 복원 (권장)** — 이 스토어는 그대로 두고, 아무 데도 연결되지 않은 사본 `<name>-r<date>`를 만듭니다.
  비교한 뒤, 남길 쪽에 프로젝트를 연결하세요.
- **이 스토어의 데이터 바꾸기** — 먼저 안전 백업을 남기고, 현재 데이터베이스는 `<db>_prerestore_<time>`으로
  **이름만 바뀌며**(지워지지 않음) 새 데이터베이스를 백업으로 채웁니다. 실행되는 동안 연결된 앱은 접속 오류를 봅니다.
  7일 동안 **복원 되돌리기**로 이름을 원래대로 돌릴 수 있습니다.

어떤 복원이든 무엇을 바꾸기 전에 백업 파일의 체크섬부터 확인합니다.

## docker-compose에서 옮겨 오기

기존 데이터베이스를 업로드 한도 없이 옮기려면, 노드 운영자에게 custom 형식 덤프를 NAS에 있는 스토어의 `backups/import/`
디렉터리에 복사해 달라고 하세요:

```bash
pg_dump -Fc -d "$OLD_DATABASE_URL" -f app.dump
```

그런 다음 스토어의 백업 탭에서 원본 `import/app.dump`로 복원합니다(또는 `POST /api/stores/<id>/restore`에
`{ "source": { "path": "import/app.dump" }, "mode": "in-place", "confirm": "<store name>" }`). 객체는 **값 보기**가
보여 주는 값으로 아무 S3 도구로나 옮기면 됩니다.

## 설정과 한도

스토어 페이지의 **설정** 탭에서는 이름을 바꾸고(주소가 바뀌므로 연결된 프로젝트를 다시 배포합니다), 메모리와 CPU를
바꾸고(컨테이너를 다시 만듭니다 — 잠시 끊김), **접속 정보를 교체**하고(관리자: 안전 백업 뒤 새 비밀번호와 키; 연결된
프로젝트를 모두 다시 배포), 스토어 자체의 로그를 봅니다. **삭제**는 연결된 프로젝트가 하나라도 있으면 거절됩니다. 삭제할
때는 마지막 백업을 먼저 남기고, 데이터는 노드의 휴지통에 30일 동안 남습니다.

| 한도 | 기본값 |
|---|---|
| 프로젝트당 스토어 | 4 |
| 조직당 스토어 | 8 (노드 운영자가 정함) |
| 스토어당 프로젝트 | 16 |
| SQL 문장 하나 | 16 KiB, 10초, 200행, 결과 1 MiB |
| AinDrive로 복사되는 백업 하나 | 2 GiB |
| 제자리 복원 되돌리기 | 7일 |
| 삭제된 스토어의 데이터가 휴지통에 남는 기간 | 30일 |

이 모든 것 뒤의 HTTP 경로는 [HTTP API 레퍼런스](/docs/ko/reference/http-api)의 **Storage** 아래에 있습니다.
