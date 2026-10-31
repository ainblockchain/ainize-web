---
title: "설계 (검토 중): AIN Store — web3 Firestore"
summary: 상태 — 승인 대기. AIN 블록체인이 인덱스·규칙·트리거를 맡고, AinDrive가 문서 본문을 담고, AIN SSO가 모든 권한의 신원이 되며, ainize Runs가 같은 신원으로 트리거를 실행하는 Firestore 대체제입니다.
source: en/design/ain-data-platform.md
source_sha256: 7cc900612b416a48893fa7d1ada033f01b94317920bf0b32b6e577fcabd52c6e
---

# 설계 (검토 중): AIN Store — web3 Firestore

**상태: 승인 대기 (2026-10-31).**

AIN Store는 ainize 앱이 Firestore 대신 쓰는 데이터베이스입니다. 문서와 컬렉션, 질의, 실시간 리스너, 보안 규칙, 트리거처럼 Firestore를 편하게 만든 것은 그대로 둡니다. 다른 것은 권한이 어디에 있느냐입니다. Firestore의 규칙과 트리거는 Google 안에서 돌고, Google이 제대로 적용한다고 믿어야 합니다. AIN Store에서는 **AIN 블록체인 합의** 안에서 돕니다. 모든 노드가 모든 쓰기를 규칙에 대고 확인하고, 모든 트리거는 확정된 트랜잭션에서 발동합니다. 운영자를 포함해 누구도 규칙을 건너뛰거나 트리거를 우회하면 드러납니다.

| 구성요소 | 역할 | Firestore에서는 |
| --- | --- | --- |
| AIN 블록체인 | **인덱스**(문서마다 해시와 버전 한 줄), **규칙**(`.rule`), **트리거**(`.function`), 변경 이벤트 | 문서 메타데이터, 보안 규칙, 함수 트리거, 리스너 |
| AinDrive | 해시 주소로 저장하는 **문서 본문과 파일** | 문서 내용, Cloud Storage |
| AIN SSO | 사용자·조직·서비스의 **신원과 역할**, 세션·에이전트·Runs에 대한 위임 | Firebase Auth, custom claims |
| ainize Runs | SSO가 발급한 범위 한정 신원으로 **트리거 실행** | Cloud Functions |
| Store 게이트웨이 (프로젝트별) | SDK 엔드포인트, 질의 캐시, 실시간 전달. 권한은 없음 | Firestore 프런트엔드 |

## 원칙

1. **체인이 인덱스입니다.** 문서마다 체인에 작은 항목 하나가 있습니다. 그 항목으로 문서를 찾고, 검증하고, 규칙과 트리거를 붙입니다.
2. **본문은 해시를 주소로 AinDrive에 둡니다.** 체인의 해시가 곧 AinDrive 주소이므로, 찾는 것과 검증하는 것이 한 단계입니다.
3. **규칙과 트리거는 합의로 강제합니다.** 체인만 줄 수 있는 것이고, 인덱스를 체인에 두는 이유입니다.
4. **처음부터 끝까지 한 신원.** 쓰기에 서명한 SSO 계정이 곧 규칙이 보는 `auth`입니다. 그 쓰기가 일으킨 트리거는 그 계정이나 앱 자신의 계정에서 파생한 권한으로 실행되며, 그보다 넓어지지 않습니다.
5. **나머지는 전부 다시 만들 수 있습니다.** 게이트웨이의 질의 캐시는 언제든 체인과 AinDrive로 다시 만듭니다.

## 데이터 모델

```text
체인     /apps/<app>/<collection>/<docId>        = "<version>:<sha256 base64url>"
         /apps/<app>/<collection>/.rule          쓰기 규칙 (합의)
         /apps/<app>/<collection>/$id/.function  트리거 → ainize Runs
AinDrive <조직 드라이브>/store/<app>/objects/<sha256>  문서 본문(JSON) 또는 파일 바이트
```

- **인덱스 항목:** 문서마다 문자열 하나, `"<version>:<hash>"`입니다. 값을 하나로 두면 문서당 약 300바이트로 줄어듭니다. 체인은 노드 하나를 값 크기 + 160바이트로 셉니다.
- **하위 컬렉션:** `/apps/<app>/users/<uid>/payments/<pid>`처럼 경로를 중첩합니다. Firestore와 같은 모양입니다.
- **본문:** sha256을 주소로 AinDrive에 JSON으로 저장합니다. 수정하면 새 객체와 새 항목을 씁니다. 이전 객체는 컬렉션 정책에 따라 이력으로 남기거나 정리합니다.
- **비공개 컬렉션:** 체인은 공개이므로 비공개 컬렉션의 `<docId>`는 조직 키로 만든 원래 id의 HMAC입니다. 인덱스에는 개수와 시점만 드러나고 이름이나 내용은 드러나지 않습니다. 본문은 AinDrive 권한 뒤에 있습니다.
- **공개 컬렉션:** 게임 점수나 NFT 메타데이터처럼 다른 앱이 우리 없이 읽어야 하는 값은 해시 대신 값 자체를 체인에 둘 수 있습니다.

## 쓰기 경로

```text
SDK ─► 게이트웨이 ─► AinDrive: 본문 저장 → sha256
                    └► 체인 tx: SET_VALUE /apps/<app>/<col>/<id> = "v:hash"   (사용자 세션 키로 서명)
                          ├ .rule이 auth(SSO 계정, 조직 역할), 형태, 버전을 확인
                          ├ 확정 → 변경 이벤트 → 게이트웨이 캐시 + 실시간 리스너
                          └ .function → ainize Runs (트리거)
```

1. SDK는 쓰기를 즉시 로컬에 반영하고 대기 중으로 표시합니다. Firestore의 지연 보정과 같습니다.
2. 게이트웨이가 본문을 AinDrive에 올리고 해시를 받습니다.
3. 체인 트랜잭션은 사용자의 **세션 키**로 서명합니다. 여러 쓰기를 한 트랜잭션에 묶으면 Firestore batch처럼 원자적입니다.
4. 합의에서 규칙이 판단합니다. 거부되면 클라이언트는 규칙의 오류와 함께 되돌립니다.
5. 확정되면 변경 이벤트가 게이트웨이의 질의 캐시와 조건에 맞는 모든 `onSnapshot` 리스너를 갱신합니다.

## 읽기 경로

- **id로 조회:** 체인에서 인덱스 항목을 읽고, 해시로 AinDrive에서 본문을 가져와 해시를 검증합니다. SDK는 기본으로 검증합니다.
- **질의:** `where`, `orderBy`, `limit`, 커서는 게이트웨이의 SQLite 캐시에서 실행합니다. 캐시는 체인 이벤트와 AinDrive 본문으로 만들고, 인덱스는 컬렉션마다 선언합니다. 원천이 아니므로 지워도 다시 만들어집니다.
- **실시간:** 체인 변경 이벤트를 SSE 리스너에 전달하고, 리스너마다 읽기 권한으로 거릅니다.
- **읽기 권한:** 체인 인덱스는 공개이므로 읽기 통제는 본문에 적용합니다. AinDrive가 SSO 역할과 공유로 강제하고, 게이트웨이가 질의에 컬렉션의 `read` 규칙을 적용합니다.

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
/apps/donga/articles/.rule.write:
  getValue('/apps/ain_sso/sessions/' + auth.addr + '/org') === 'org_donga'
  && ['editor','admin'].includes(getValue('/apps/ain_sso/orgs/org_donga/members/'
       + getValue('/apps/ain_sso/sessions/' + auth.addr + '/addr')))
  && util.isString(newData)
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

- **트리거 선언:** `ainize.json`에 트리거마다 쓸 수 있는 경로와 읽을 수 있는 AinDrive 객체를 선언합니다. 예: `"on-article": { "type": "ain", "path": "/apps/donga/articles/$id", "as": "app", "writes": ["/apps/donga/translations/$id"] }`.
- **앱으로 실행 (`as: "app"`):** Run은 조직이 소유한 프로젝트 자신의 SSO 서비스 계정으로 동작합니다. 권한은 선언한 범위이며, 조직이 그 계정에 준 역할을 넘지 않습니다.
- **호출자로 실행 (`as: "caller"`):** Run은 트리거한 트랜잭션에 서명한 계정을 대신해 동작합니다. 그 사용자가 할 수 있는 것 이상은 할 수 없습니다.
- **검증된 이벤트:** 노드는 무엇이든 실행하기 전에 이벤트를 체인에 대고 확인합니다. 트리거별 URL 토큰은 요청 수 제한 용도로만 남깁니다.
- **일회용 키:** Run의 세션 키는 실행 시간 제한과 함께 만료됩니다. 조직의 위임을 폐기하면 그 조직의 Runs도 멈춥니다.
- **스케줄·웹훅 트리거:** 항상 `as: "app"`으로 실행합니다.

## 용량과 비용

| 프로젝트 | 문서 수 (2026-10-31 실측) | 체인 인덱스 (문서당 약 300B) |
| --- | --- | --- |
| 동아사이언스 | 214,566 (translations 70,067, evaluations 70,059, articles 68,287) | 약 64MB |
| 베이비샤크 | 최상위 8,669 + 작은 하위 컬렉션 | 약 2.6MB |
| a2a orchestrator | 레코드 약 6,000 | 약 1.8MB |

- 지금의 무료 풀은 스테이킹하지 않은 모든 앱이 함께 쓰는 100MB라서 동아 하나도 들어가지 않습니다. 현재 전체 스테이크 기준으로 64MB를 스테이킹으로 확보하려면 약 27만 AIN이 필요합니다. 50 AIN으로 11.9KB를 얻습니다.
- **제안:** 공용 풀 대신 **앱별 명시 예산** `resource/app_state_budget/<app>`을 둡니다. 앱을 온보딩할 때 params owner가 거버넌스 트랜잭션으로 정합니다. 예산을 넘은 앱은 자기 쓰기만 실패하고, 삭제는 항상 허용합니다.
- **쓰기:** 쓰기나 batch마다 트랜잭션 하나입니다. 동아는 30일에 문서 약 1만 5천 건을 써서 체인 처리량 안에 넉넉히 들어옵니다. 쓰기는 확정 시점(수 초)에 응답하고, Firestore처럼 SDK의 대기 상태가 그 시간을 가립니다.
- **읽기**는 합의에 닿지 않고 게이트웨이 캐시와 AinDrive에서 처리합니다. 동아의 30일 읽기 570만 회는 관리자 대시보드가 5초마다 통계를 조회한 탓이었고, donga-science-backend #56과 donga-science-admin #14에서 따로 고쳤습니다.
- **모니터링:** 5분마다 앱별 예산 사용량, 트리거 실패, 캐시 지연을 확인해 70%, 85%에서 AIN Teams #comcom에 알립니다.

## Firebase에서 옮기기

| Firebase | AIN Store |
| --- | --- |
| Firestore 문서와 컬렉션 | 체인의 인덱스 항목 + AinDrive의 본문 |
| 질의, `onSnapshot` | 게이트웨이 캐시 질의, 체인 이벤트 기반 SSE 리스너 |
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
3. Store: SDK, 게이트웨이(AinDrive 본문, 질의 캐시, SSE), 규칙 도우미.
4. Runs: 이벤트 검증, 위임, `as`와 `writes`, 체인 설치.
5. 베이비샤크 → nft-server → 동아사이언스(1주일 병행 운영) → orchestrator 순으로 이전.

## 승인이 필요한 결정

- **D1. 체인이 인덱스:** 문서마다 항목 하나(`"version:hash"`), 본문은 해시로 AinDrive에.
- **D2. 공용 무료 풀 대신 거버넌스로 정하는 앱별 상태 예산, 삭제는 항상 허용.** 메인넷 합의 변경입니다.
- **D3. SSO가 조직·멤버·세션을 체인에 게시하고, 사용자는 SSO가 발급한 세션 키로 서명.**
- **D4. Runs는 `as: "app"`(기본) 또는 `as: "caller"`로 실행하고, SSO 리소스 위임으로 선언한 경로에 한정.**
- **D5. 비공개 컬렉션은 HMAC 문서 id.**
