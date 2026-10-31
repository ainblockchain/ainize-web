---
title: "설계 (검토 중): AIN Store — web3 Firestore"
summary: 상태 — 승인 대기. AIN 블록체인이 권한(규칙, 트리거, 순서가 정해진 쓰기 로그, DB 상태에 대한 커밋 하나)을 맡고, AinDrive가 문서와 로그 보관본을 담고, 프로젝트별 SQLite가 유일한 인덱스이며, AIN SSO가 모든 권한의 신원이고, ainize Runs가 같은 신원으로 트리거를 실행하는 Firestore 대체제입니다.
source: en/design/ain-data-platform.md
source_sha256: 5806e2114f8ddcabcd09eedb022819242cb194019b876857290dfefdb75ea5a7
---

# 설계 (검토 중): AIN Store — web3 Firestore

**상태: 승인 대기 (2026-10-31).**

AIN Store는 ainize 앱이 Firestore 대신 쓰는 데이터베이스입니다. 문서와 컬렉션, 질의, 실시간 리스너, 보안 규칙, 트리거처럼 Firestore를 편하게 만든 것은 그대로 둡니다. 다른 것은 권한이 어디에 있느냐입니다. Firestore의 규칙과 트리거는 Google 안에서 돌고, Google이 제대로 적용한다고 믿어야 합니다. AIN Store에서는 **AIN 블록체인 합의** 안에서 돕니다. 모든 노드가 모든 쓰기를 규칙에 대고 확인하고, 모든 트리거는 확정된 트랜잭션에서 발동합니다. 운영자를 포함해 누구도 규칙을 건너뛰거나 트리거를 우회하면 드러납니다.

| 구성요소 | 역할 | Firestore에서는 |
| --- | --- | --- |
| AIN 블록체인 | **권한**: 규칙(`.rule`), 트리거(`.function`), 크기가 제한된 **순서 있는 쓰기 로그**, DB 현재 상태에 대한 **커밋** 하나 | 보안 규칙, 함수 트리거, Google이 내부에 두는 커밋 순서 |
| AinDrive | 해시 주소로 저장하는 **문서 본문과 파일**, **로그 보관본** | 문서 내용, Cloud Storage |
| Store (프로젝트별) | **SQLite: 유일한 인덱스.** 체인 로그와 AinDrive 본문을 재생해 만들고, 조회·질의·실시간을 처리 | Firestore의 저장소와 인덱스 |
| AIN SSO | 사용자·조직·서비스의 **신원과 역할**, 세션·에이전트·Runs에 대한 위임 | Firebase Auth, custom claims |
| ainize Runs | SSO가 발급한 범위 한정 신원으로 **트리거 실행** | Cloud Functions |

## 원칙

1. **인덱스는 한 번만.** id나 필드로 문서를 찾는 것은 DB의 일이고, SQLite가 이미 합니다. 체인에 그 인덱스를 문서마다 복제하지 않습니다. 체인에는 체인만 줄 수 있는 것을 둡니다.
2. **체인이 모든 쓰기의 순서를 정하고 승인합니다.** 쓰기 하나가 체인의 로그 항목 하나이고, 합의로 규칙을 검사받으며 트리거를 일으킬 수 있습니다. 로그의 순서가 곧 DB의 순서입니다.
3. **DB는 로그의 결정적 함수입니다.** AinDrive의 본문과 함께 로그를 재생하면 같은 SQLite가 만들어집니다. 그래서 Store 자체에는 권한이 없습니다.
4. **문서마다 항목 하나가 아니라 커밋 하나.** Store는 현재 상태의 머클 루트를 게시합니다. 어떤 문서든 그 루트로 증명할 수 있고, 누구나 재생해서 루트를 다시 계산할 수 있습니다.
5. **처음부터 끝까지 한 신원.** 쓰기에 서명한 SSO 계정이 곧 규칙이 보는 `auth`입니다. 그 쓰기가 일으킨 트리거는 그 계정이나 앱 자신의 계정에서 파생한 권한으로 실행되며, 그보다 넓어지지 않습니다.

## 데이터 모델

```text
체인     /apps/<app>/log/<collection>/<key>   = { id, op, base, h }   쓰기 로그, 오래된 항목은 자동 정리
         /apps/<app>/log/<collection>/.rule   쓰기 규칙(합의) + 상태 규칙 { gc_max_siblings, max_bytes }
         /apps/<app>/log/<collection>/$key/.function   트리거 → ainize Runs
         /apps/<app>/commit                   = { upTo, root, segment }   값 하나를 덮어씀
AinDrive <조직 드라이브>/store/<app>/objects/<sha256>   문서 본문(JSON) 또는 파일 바이트
         <조직 드라이브>/store/<app>/log/<segment>      체인 순서대로 보관한 로그 항목
Store    SQLite: documents (collection, id, version, hash, data) + 선언한 인덱스
```

- **로그 항목:** `{ id, op: "set" | "merge" | "delete", base: <기준 버전>, h: <본문 해시> }`, 약 400바이트입니다. `<key>`는 시간 순서의 push id라서, 체인의 상태 규칙(`gc_max_siblings`, 예: 1,000)이 가장 오래된 항목부터 자동으로 지웁니다. 문서가 몇 개든 컬렉션별 체인 상태는 일정 크기를 넘지 않습니다.
- **본문:** sha256을 주소로 AinDrive에 JSON으로 둡니다. 로그 항목에는 해시만 있습니다.
- **로그 적용:** Store는 확정된 로그 항목을 체인 순서대로 따라가며 본문을 가져와 SQLite에 적용합니다. `base`가 문서의 현재 버전과 다른 항목은 재생할 때마다 똑같이 거부됩니다. 로그 순서로 결정되는 낙관적 동시성 제어입니다.
- **커밋:** Store는 N개 항목이나 N분마다 `(collection, id, version, hash)`, 즉 SQLite가 이미 가진 행들로 머클 루트를 만듭니다. 그리고 루트, 그 루트가 포함하는 마지막 로그 위치, 보관한 AinDrive 로그 세그먼트를 `/apps/<app>/commit`에 덮어씁니다.
- **이력:** 노드는 이력을 일정 기간만 보관하므로, Store는 체인이 로그를 정리하기 전에 AinDrive 세그먼트로 보관합니다. 보관본과 본문이 완전한 원본입니다. Store를 잃으면 여기서 다시 만들고, 다시 만든 루트는 커밋된 루트와 같아야 합니다.
- **비공개 컬렉션:** 로그 항목의 문서 id는 조직 키로 만든 HMAC입니다. 본문은 AinDrive 권한 뒤에 있습니다.
- **공개 컬렉션:** 게임 점수나 NFT 메타데이터는 값 자체를 로그 항목에 넣고, 다른 앱이 읽을 수 있게 체인에 작은 공개 사본을 둘 수 있습니다.

## 쓰기 경로

```text
SDK ─► Store ─► AinDrive: 본문 저장 → sha256
               └► 체인 tx: SET_VALUE /apps/<app>/log/<col>/<key> = { id, op, base, h }   (사용자 세션 키로 서명)
                     ├ .rule이 auth(SSO 계정, 조직 역할)와 항목 형태를 확인   — 합의
                     ├ .function → ainize Runs (트리거)
                     └ 확정 → Store가 SQLite에 적용 → 실시간 리스너
```

1. SDK는 쓰기를 즉시 로컬에 반영하고 대기 중으로 표시합니다. Firestore의 지연 보정과 같습니다.
2. Store가 본문을 AinDrive에 올립니다. 체인 트랜잭션은 사용자의 **세션 키**로 서명하고, batch는 트랜잭션 하나로 묶습니다.
3. 합의에서 규칙을 검사합니다. 거부되면 클라이언트는 규칙의 오류와 함께 되돌립니다.
4. 항목이 확정되면 Store가 적용합니다. `base`가 오래됐으면 Firestore가 실패한 트랜잭션을 알리듯 클라이언트에 충돌로 알립니다.

**규칙이 검사할 수 있는 것.**
- **합의로 강제:** 누가 쓰는지(SSO 계정, 조직, 역할, 세션 만료), 무엇을 쓰는지(형태, 크기, 허용된 연산), 컬렉션의 한도.
- **재생 시 강제:** "작성자만 수정 가능"처럼 문서의 기존 내용에 달린 조건. 체인에 문서별 상태가 없으므로 이런 규칙은 로그를 적용할 때 결정적으로 실행됩니다. 위반은 재생할 때마다 똑같이 거부되고, 누구나 재생해서 확인할 수 있습니다.
- 이런 조건을 합의로 강제해야 하는 컬렉션은 작성자처럼 작은 문서별 필드를 체인에 두도록 선택할 수 있습니다.

## 읽기 경로

- **조회, 질의, 실시간:** 모두 Store의 SQLite가 처리합니다. `where`, `orderBy`, `limit`, 커서, `onSnapshot`. 로그로 최신 상태를 유지하는 유일한 인덱스입니다.
- **검증:** SDK는 어떤 문서든 머클 증명을 함께 받아 `/apps/<app>/commit`에 대고 확인할 수 있습니다. 본문 해시도 확인합니다.
- **읽기 권한:** 로그에는 내용이 아니라 해시만 있습니다. 본문은 SSO 역할과 공유에 따른 AinDrive 권한으로 보호하고, Store는 질의와 리스너에 컬렉션의 `read` 규칙을 적용합니다.

## AIN SSO로 권한 연결

### 체인 위의 신원

- **계정:** SSO 계정마다 AIN 주소가 있습니다. 사용자가 자기 지갑을 연결하거나, SSO가 계정의 패스키(AIN WebAuthn-P256)에서 주소를 만듭니다.
- **디렉터리:** SSO는 규칙이 필요로 하는 정보를 자기 체인 앱에 게시합니다. 앱에 쓰던 push 모델을 그대로 씁니다.
  - `/apps/ain_sso/orgs/<org>/members/<addr> = "<role>"`
  - `/apps/ain_sso/sessions/<sessionAddr> = { addr, org, exp }`
- **세션:** 로그인하면 수명이 짧은 세션 키(디바이스 위임의 `cnf` 키)가 생기고, SSO가 이를 `sessions/`에 등록합니다. 브라우저가 이 키로 서명하므로 사용자는 체인 키를 다룰 일이 없습니다.
- **수명 주기:** 정지, 퇴사 처리, 세션 폐기는 해당 항목을 지웁니다. 다음 블록부터 그 항목을 확인하는 모든 규칙이 거부합니다.

### 규칙

```text
/apps/donga/log/articles/.rule.write:
  getValue('/apps/ain_sso/sessions/' + auth.addr + '/org') === 'org_donga'
  && ['editor','admin'].includes(getValue('/apps/ain_sso/orgs/org_donga/members/'
       + getValue('/apps/ain_sso/sessions/' + auth.addr + '/addr')))
  && util.isDict(newData) && ['set','merge','delete'].includes(newData.op)
```

SDK는 `role in ['editor','admin']`을 이 형태로 바꿔 주는 도우미를 제공합니다. 규칙은 Firestore 규칙처럼 앱과 함께 리뷰하고 배포합니다.

### 트리거와 ainize Runs

```text
확정된 tx ─► 체인 .function (REST, 화이트리스트 URL) ─► ainize 노드
   노드: tx를 해시로 조회해 확정됐는지, 이 경로를 썼는지 확인          (위조 이벤트 차단)
   노드: 이번 실행을 위한 리소스 범위 위임(ain-rdlg+jwt)을 SSO에 요청
   Run은 그 위임과, /apps/ain_sso/sessions에 등록한 일회용 세션 키로 실행
   Run의 쓰기도 같은 체인 규칙을 통과해야 함
```

- **트리거 선언:** `ainize.json`에 트리거마다 쓸 수 있는 경로와 읽을 수 있는 AinDrive 객체를 선언합니다. 예: `"on-article": { "type": "ain", "path": "/apps/donga/log/articles/$key", "as": "app", "writes": ["/apps/donga/log/translations"] }`.
- **앱으로 실행 (`as: "app"`):** Run은 조직이 소유한 프로젝트 자신의 SSO 서비스 계정으로 동작합니다. 권한은 선언한 범위이며, 조직이 그 계정에 준 역할을 넘지 않습니다.
- **호출자로 실행 (`as: "caller"`):** Run은 트리거한 트랜잭션에 서명한 계정을 대신해 동작합니다. 그 사용자가 할 수 있는 것 이상은 할 수 없습니다.
- **검증된 이벤트:** 노드는 무엇이든 실행하기 전에 이벤트를 체인에 대고 확인합니다. 트리거별 URL 토큰은 요청 수 제한 용도로만 남깁니다.
- **일회용 키:** Run의 세션 키는 실행 시간 제한과 함께 만료됩니다. 조직의 위임을 폐기하면 그 조직의 Runs도 멈춥니다.
- **스케줄·웹훅 트리거:** 항상 `as: "app"`으로 실행합니다.

## 용량과 비용

이제 체인 상태는 문서 수가 아니라 로그 창의 크기로 정해집니다.

| 프로젝트 | 문서 수 (2026-10-31 실측) | 쓰기 빈도 | 체인 상태 |
| --- | --- | --- | --- |
| 동아사이언스 | 214,566 | 2026년 10월 새 기사 약 440건, 기사마다 번역 1건과 평가 1건 | 컬렉션별 로그 창 1,000개 × 약 400B ≈ 컬렉션당 0.4MB, 커밋 값 하나 추가 |
| 베이비샤크 | 최상위 8,669 | 적음 | 0.5MB 미만 |
| a2a orchestrator | 약 6,000 | 적음 | 0.5MB 미만 |

- 문서마다 항목을 두면 동아에 약 64MB가 필요했지만, 로그 방식이면 5MB에 한참 못 미칩니다. 승인받은 동아 한도 상향으로 넉넉히 감당합니다.
- **앱별 예산**(결정 D2)은 계속 격리 장치입니다. 체인의 기존 상태 규칙 `max_bytes`로 로그 경로마다 상한도 겁니다.
- **쓰기:** 쓰기나 batch마다 트랜잭션 하나이고, 확정 시점(수 초)에 응답하며 SDK의 대기 상태가 그 시간을 가립니다.
- **읽기**는 체인에 닿지 않습니다.
- **모니터링:** 5분마다 앱별 예산 사용량, 로그 지연(Store의 적용 위치와 체인의 차이), 보관 지연(체인 정리보다 앞서 있어야 함), 트리거 실패를 확인해 70%, 85%에서 AIN Teams #comcom에 알립니다.

## Firebase에서 옮기기

| Firebase | AIN Store |
| --- | --- |
| Firestore 문서와 컬렉션 | Store의 SQLite, AinDrive의 본문, 체인 로그 항목으로서의 쓰기 |
| 질의, `onSnapshot` | Store 질의와 SSE 리스너 |
| 보안 규칙 | 체인 `.rule`, `/apps/ain_sso`를 통한 SSO 역할 |
| Cloud Functions 트리거 | 체인 `.function` → ainize Runs, SSO 위임 |
| Firebase Auth | AIN SSO. 기존 Firebase Auth 사용자는 내보내서 보존 |
| Cloud Storage | AinDrive 객체 |

| 프로젝트 | 빌링 해제 전 게이트 |
| --- | --- |
| 베이비샤크 (`babyshark-187c9`) | https://nft.babyshark.com/game 에서 게임하면 보상이 지급됨. utility 페이지 이미지 로드 |
| nft-server (`nft-server-prod`) | 호스팅하는 모든 토큰 URI가 바이트까지 같은 JSON을 반환 |
| 동아사이언스 (`donga-science-prod`) | 새 기사가 수집 → 번역 → 검토 → https://dongascience.com/en 게시까지 흐름. 관리자 대시보드 정상 |
| a2a orchestrator | ainspace 리포트·채팅 흐름이 같은 결과를 냄. 체인의 암호화 상태 제거 |

모든 이전은 같은 단계를 따릅니다: 내보내기 → 가져오기 → 병행 운영하며 비교 → 전환 → 실서비스 검증 → 기존 사본 제거 → 빌링 해제.

## ainize Runs에 더 필요한 것

"트리거와 ainize Runs" 절의 내용 중 아직 없는 것들입니다.

- 체인의 REST 함수 화이트리스트에 ainize 실행 URL 추가.
- 노드에 ain-js 연결. "체인에 설치"가 503 대신 실제로 동작하게.
- 이벤트를 체인에 대고 검증.
- 실행마다 SSO 리소스 범위 위임 발급과 일회용 세션 키 등록.
- 트리거 선언에 `as`와 `writes` 추가.

지금은 트리거된 Run이 프로젝트를 마지막으로 push한 사람의 키로 실행되며, 이 설계가 그것을 대체합니다.

## 만드는 순서

1. 체인: 앱별 예산, 삭제는 항상 허용, ainize를 REST 화이트리스트에 추가.
2. SSO: 디렉터리 게시(`/apps/ain_sso`의 조직·멤버·세션), 로그인 시 세션 키 발급.
3. Store: SDK, 로그 추적과 결정적 적용, SQLite 인덱스, 커밋과 증명, AinDrive 본문과 로그 보관, SSE, 규칙 도우미.
4. Runs: 이벤트 검증, 위임, `as`와 `writes`, 체인 설치.
5. 베이비샤크 → nft-server → 동아사이언스(1주일 병행 운영) → orchestrator 순으로 이전.

## 승인이 필요한 결정

- **D1. 체인에 문서별 인덱스를 두지 않음.** 체인에는 규칙, 트리거, 크기가 제한된 쓰기 로그, 커밋 하나만 둡니다. SQLite가 유일한 인덱스이고, AinDrive가 본문과 로그 보관본을 담습니다.
- **D2. 공용 무료 풀 대신 거버넌스로 정하는 앱별 상태 예산, 삭제는 항상 허용.** 메인넷 합의 변경입니다. 동아 한도 상향은 승인됨.
- **D3. SSO가 조직·멤버·세션을 체인에 게시하고, 사용자는 SSO가 발급한 세션 키로 서명.**
- **D4. Runs는 `as: "app"`(기본) 또는 `as: "caller"`로 실행하고, SSO 리소스 위임으로 선언한 경로에 한정.**
- **D5. 데이터에 달린 규칙은 기본적으로 결정적 재생에서 실행하고, 문서별 필드를 두는 선택으로 합의 강제.**
