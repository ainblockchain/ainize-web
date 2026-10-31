---
title: "설계 (검토 중): AIN Store — web3 Firestore"
summary: 상태 — 승인 대기. ainize 앱이 Firestore 대신 쓰는 데이터베이스입니다. 문서, 질의, 실시간 구독, 규칙, 파일, 트리거를 제공하고, 원본은 AinDrive에 두며 무결성은 AIN 블록체인에 앵커합니다. Supabase와 PocketBase의 구조를 참고했습니다.
source: en/design/ain-data-platform.md
source_sha256: 97672e503c692e0e6eb2918a2aa9528e47077ec56b215965f6a831731e5f49d8
---

# 설계 (검토 중): AIN Store — web3 Firestore

**상태: 승인 대기 (2026-10-31).**

AIN Store는 ainize 위의 앱이 Firestore 대신 쓰는 데이터베이스입니다. Firestore를 편하게 만든 것들, 즉 문서와 컬렉션, 질의, 실시간 리스너, 보안 규칙, 파일 필드, 트리거를 그대로 제공합니다. 그리고 Firestore가 못 하는 것을 더합니다.

- **원본은 소유자의 것입니다.** 클라우드 업체가 아니라 소유자의 AinDrive에 있습니다.
- **모든 변경을 검증할 수 있습니다.** 변경 묶음을 AIN 블록체인에 앵커합니다.
- **신원은 AIN입니다.** 사용자는 AIN SSO나 AIN 지갑으로 로그인합니다.

## 요구사항

1. **Firestore만큼 편하게.** CRUD를 위해 백엔드를 짤 필요가 없습니다. `collection / doc / where / orderBy / limit / onSnapshot`을 쓰는 클라이언트 SDK와, 컬렉션별 선언형 규칙을 제공합니다.
2. **원본은 AinDrive에.** 모든 DB와 파일의 영구 사본은 AinDrive에 있습니다. 노드에 있는 것은 전부 AinDrive에서 다시 만들 수 있습니다.
3. **체인에는 증명과 공개용 사실만.** 해시 루트, 포인터, 공개하려는 데이터만 올립니다. 대용량 데이터나 암호화 데이터는 올리지 않습니다. 아무도 읽을 수 없고, 모든 바이트가 앱들이 함께 쓰는 예산에서 나가기 때문입니다.
4. **격리.** 한 앱의 크기나 트래픽 때문에 다른 앱이 멈추지 않습니다. 체인에서도, 호스팅 노드에서도 마찬가지입니다.
5. **작을 때는 싸게, 가장 큰 곳에서도 충분하게.** 대부분의 앱은 작습니다. 베이비샤크는 30일에 읽기 약 3천 회입니다. 지금 가장 큰 곳은 동아사이언스로, 30일에 읽기 약 620만 회, 쓰기 약 1만 5천 회입니다. 평균으로 초당 약 2.4회 읽기입니다.

## Supabase와 PocketBase에서 가져오는 것

| 아이디어 | 출처 | AIN Store의 적용 |
| --- | --- | --- |
| DB가 원천이고 API·실시간·스토리지는 그 주위의 얇은 서비스 | Supabase | 프로젝트마다 저장 엔진 하나. 나머지는 모두 그 커밋 로그에서 파생 |
| 접근 규칙을 데이터 옆에 두고 요청마다 평가 | Supabase (RLS), PocketBase (API rules) | 컬렉션별 `list`, `get`, `create`, `update`, `delete` 규칙식. `auth`와 `doc`을 참조 |
| 실시간은 앱 코드가 아니라 커밋 로그에서 | Supabase (WAL → Realtime) | 엔진의 커밋 스트림으로 구독을 공급 |
| 스토리지는 DB의 메타데이터 + 다른 곳의 바이트 | Supabase Storage | 파일 필드에 경로와 해시를 기록. 바이트는 AinDrive |
| 앱마다 자기완결형 서버 하나: 내장 SQLite, 스키마, 규칙, SSE 실시간, 훅, 관리 UI | PocketBase | ainize 프로젝트마다 내장 SQLite 파일을 가진 작은 Store 프로세스 하나. 공유 DB 서버 없음 |
| 확장 가능한 스키마와 스키마 없는 JSON의 공존 | PocketBase | 컬렉션은 기본적으로 스키마가 없음. 필드와 인덱스 선언은 선택 |
| 레코드 이벤트 훅 | PocketBase, Supabase functions | `onCreate`, `onUpdate`, `onDelete` 트리거를 ainize Runs로 실행 |

공유 Postgres(Supabase 방식)가 아니라 프로젝트별 SQLite(PocketBase 방식)를 고른 이유: ainize는 이미 프로젝트마다 컨테이너 하나를 띄웁니다. 프로젝트마다 Store를 하나 두면 공유 서버나 시끄러운 이웃, 테넌트 간 스키마 없이도 요구사항 4의 격리가 지켜집니다. WAL 모드 SQLite는 동아의 부하를 넉넉하게 감당합니다. 그리고 SQLite가 만드는 커밋 로그가 바로 AinDrive로 복제하고 체인에 앵커하는 대상입니다.

## 아키텍처

```text
 앱 (브라우저 / 서버) ── @ainize/store SDK ── HTTPS + SSE
                                   │
              ┌────────────────────▼─────────────────────┐
              │  Store (ainize 프로젝트마다 하나)         │
              │  ├ Document API   컬렉션, 질의           │
              │  ├ Rules engine   컬렉션별 규칙          │
              │  ├ Realtime       커밋 기반 SSE          │
              │  ├ Files          파일 필드 → AinDrive   │
              │  ├ Auth           AIN SSO / 지갑 서명    │
              │  └ SQLite (WAL)   로컬 작업 사본         │
              └──────┬──────────────────┬───────────────┘
   커밋 로그          │                  │  묶음 루트
   (세그먼트 + 스냅샷) │                  ▼
              ┌──────▼────────┐   ┌────────────────────┐
              │ AinDrive      │   │ AIN 블록체인       │
              │ 원본:         │   │ /apps/<app>/       │
              │ DB 로그, 파일 │   │   anchors/<seq>    │
              └───────────────┘   │   public/… (선택)  │
                                  └────────────────────┘
 트리거 ── ainize Runs              관리 UI ── ainize 웹 "Store" 탭
```

### 데이터 모델

- **형태:** 컬렉션에 문서가 있고, 문서 아래에 하위 컬렉션을 둘 수 있습니다. Firestore와 같습니다. 문서는 `id`, `createTime`, `updateTime`, `version`을 가진 JSON입니다.
- **저장:** 컬렉션 하나는 `(id, parent, data JSON, version, hash, timestamps)` 테이블입니다. 인덱스를 건 필드는 생성 열과 인덱스가 됩니다. 질의는 등호, 범위, `in`, `array-contains`, `orderBy`, `limit`, 커서를 지원하며 SQL로 컴파일합니다.
- **큰 값:** 256KB가 넘는 값이나 `file` 필드로 선언한 값은 AinDrive에 저장합니다. 문서에는 `{ path, sha256, size, type }`만 남습니다.

### 쓰기, 커밋, 원본

1. Store는 규칙을 확인하고 SQLite 트랜잭션으로 쓰기를 적용한 다음, 커밋 레코드 `(seq, collection, id, op, sha256(doc), prevHash)`를 추가합니다. 커밋 레코드들은 해시 체인을 이룹니다.
2. 커밋 레코드와 WAL 프레임은 약 1초 또는 4MB마다 번호가 붙은 세그먼트로 AinDrive에 흘려보내고, 매일 스냅샷을 남깁니다. **AinDrive가 원본입니다.** 새 노드는 최신 스냅샷을 복원하고 세그먼트를 재생하면 됩니다. Litestream 방식이며, 대상이 AinDrive입니다.
3. 쓰기는 로컬 커밋 시점에 응답합니다. 프로젝트가 `durability: "aindrive"`를 설정하면 해당 세그먼트가 AinDrive에 올라갈 때까지 기다립니다.

### 앵커링과 검증

- **앵커:** 변경이 있었다면 10분마다 그 기간 커밋 해시들의 머클 루트를 만들어 값 하나를 씁니다: `/apps/<app>/anchors/<seq> = { root, fromSeq, toSeq, segment }`. 쓰기가 얼마나 많든 주기마다 약 200바이트, 앱당 하루 최대 약 29KB입니다. 90일이 지난 앵커는 월별 루트로 접어서 앱별 체인 상태가 일정 크기를 넘지 않게 합니다.
- **검증:** 읽기 권한이 있는 사람은 누구나 문서와 그 커밋, 머클 경로를 받아 앵커된 루트와 맞춰 볼 수 있습니다. AinDrive에서 복원할 때도 세그먼트마다 같은 방식으로 검증합니다.

### 체인의 공개 데이터

게임 점수, NFT 메타데이터, 리더보드처럼 남이 읽으라고 있는 데이터가 있습니다. `public: chain`으로 표시한 컬렉션은 앱의 체인 할당량 안에서 문서를 `/apps/<app>/public/…`에 평문으로 미러링합니다. 나머지는 모두 체인 밖에 둡니다.

### 규칙과 인증

- **규칙:** 컬렉션마다 `list`, `get`, `create`, `update`, `delete` 규칙식을 둡니다. 식은 `auth`(`addr`, `sub`, `org`, `role`), `doc`, `request.data`를 참조합니다. 예: `create: auth.org == "donga" && request.data.status in ["draft"]`. 규칙이 없으면 거부합니다.
- **인증:** AIN SSO 세션 토큰이나 서버 nonce에 대한 AIN 지갑 서명으로 수명이 짧은 Store 토큰을 발급합니다. 서버 간 호출은 프로젝트별 키를 씁니다.

### 실시간

`onSnapshot(query)`는 SSE 스트림을 엽니다. Store는 커밋마다 열려 있는 질의와 그 규칙에 맞춰 보고, 추가·수정·삭제 변경을 보냅니다. Firestore 리스너와 의미가 같습니다.

### 트리거

컬렉션별 `onCreate`, `onUpdate`, `onDelete`는 커밋 레코드를 받는 ainize Runs로 실행합니다. 예약 작업도 Runs입니다.

### 관리

ainize 웹의 "Store" 탭에서 컬렉션 브라우저, 문서 편집기, 규칙, 인덱스, 사용량, 앵커 기록, 원하는 시점으로의 복원을 제공합니다.

## 한 앱이 다른 앱을 막지 못하게 하는 장치

| 층 | 장치 |
| --- | --- |
| 체인 (합의) | 새 파라미터 `resource/free_state_budget_per_app` (제안값 5MB). 스테이킹하지 않은 앱이 이를 넘으면 그 앱의 쓰기만 실패. 메인넷 모든 노드에서 정해진 블록부터 timer flag로 활성화 |
| 체인 (합의) | 예산 검사는 상태를 늘리는 연산에만 적용하고, 삭제는 항상 허용 |
| Store | 앱 데이터는 앵커와 `public: chain` 컬렉션을 통해서만 체인에 쓰고, 둘 다 앱 할당량으로 계량. 그 밖에 앱 데이터를 체인에 쓰는 코드 경로는 없음 |
| 호스팅 | 프로젝트마다 Store 프로세스 하나. CPU·메모리 한도와 볼륨을 따로 가짐 |
| 모니터링 | 5분마다 무료 풀 사용량, 앱별 체인 사용량, 앵커 지연을 확인해 70%, 85%에서 AIN Teams #comcom에 알림 |

## Firebase에서 옮기기

| Firebase 기능 | AIN Store |
| --- | --- |
| Firestore 컬렉션, 질의, `onSnapshot` | 컬렉션, 같은 질의 연산자, SSE 기반 `onSnapshot` |
| Security rules | 컬렉션 규칙 (번역 가이드와 흔한 패턴 변환기 제공) |
| Realtime Database 경로 | 최상위 경로마다 컬렉션 하나 |
| Firebase Storage / GCS | AinDrive의 파일 필드 |
| Cloud Functions | ainize Runs 트리거 |
| Firebase Auth | AIN SSO 또는 지갑. 기존 Firebase Auth 사용자는 내보내서 보존 |

| 프로젝트 | 옮기는 것 | 빌링 해제 전 게이트 |
| --- | --- | --- |
| 베이비샤크 (`babyshark-187c9`) | Firestore 사용자·결제·대여, 이미지는 파일 필드. 게임 점수는 `public: chain` 컬렉션으로 체인에 유지 | https://nft.babyshark.com/game 에서 게임하면 보상이 지급됨. utility 페이지 이미지 로드 |
| nft-server (`nft-server-prod`) | RTDB `nftSymbols`, `nftMetadataHosting`을 컬렉션으로. 작은 서비스가 `/metadata/:appId/:symbol/:tokenId`를 계속 서빙 | 호스팅하는 모든 토큰 URI가 바이트까지 같은 JSON을 반환 |
| 동아사이언스 (`donga-science-prod`) | Firestore 컬렉션 20개. 백엔드의 `infrastructure/firestore/*.repository.ts`를 같은 인터페이스 뒤에서 Store SDK로 교체 | 새 기사가 수집 → 번역 → 검토 → https://dongascience.com/en 게시까지 흐름. 관리자 대시보드 정상 |
| a2a orchestrator | 스레드·메시지·리포트를 컬렉션으로, 리포트 본문은 파일 필드로. 체인의 암호화 상태 제거 | ainspace 리포트·채팅 흐름이 같은 결과를 냄 |

모든 이전은 같은 단계를 따릅니다: 내보내기 → 가져오기 → 병행 운영하며 비교 → 전환 → 실서비스 검증 → 기존 사본 제거 → 빌링 해제.

## 만드는 순서

1. 체인 안전장치와 모니터링.
2. Store 핵심: 문서 API, 규칙, SQLite, 커밋 로그, AinDrive 복제와 복원.
3. 실시간, 앵커, 검증, 파일 필드.
4. SDK, 관리 탭, 트리거.
5. 베이비샤크 → nft-server → 동아사이언스(1주일 병행 운영) → orchestrator 순으로 이전.

## 승인이 필요한 결정

- **D1. 공유 Postgres(Supabase 방식) 대신 프로젝트별 내장 SQLite(PocketBase 방식).** 격리와 "프로젝트당 컨테이너 하나" 구조에 맞으므로 추천합니다.
- **D2. 원본은 AinDrive의 커밋 로그와 스냅샷이고, 노드의 SQLite 파일은 다시 만들 수 있는 작업 사본.**
- **D3. 체인 앱별 상한 5MB, 삭제는 항상 허용.** 메인넷 합의 변경입니다.
- **D4. 앵커 주기 10분, 90일 지난 앵커는 접기.**
- **D5. 쓰기는 기본적으로 로컬 커밋 시점에 응답하고, `durability: "aindrive"`는 선택.**
