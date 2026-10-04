# AgentLinkPage 미저장 입력 보존

## 사전 승인 범위

사용자가 승인한 무인 버그 수정: draft 초기화 수정, 기존 도구를 이용한 회귀 테스트,
초기 로드·같은 ID 재조회·다른 ID 이동·새 agent 작성 검증. 제품 의존성 추가,
버전 변경, 커밋·PR·병합·배포 및 운영 데이터 변경은 범위 밖이다.
이 체크아웃에 적용되는 AGENTS.md/CLAUDE.md 또는 EPIC 작성 의무는 발견되지 않았다.

## 근거 구분

- 이전 QA `6c05b474`는 진단 도구 부족으로 중단되었다. 이전 요청의 구체적인 추측은
  이번 입력에 제공되지 않았으므로 확인된 사실로 취급하지 않는다.
- 컨트롤러가 보고한 확인된 재현: 실제 `src/screens/AgentLinkPage.tsx`, React 19.2.8,
  조회·라우터·스타일 의존성을 통제한 환경에서 `Original name`을 `Unsaved draft`로
  입력한 후 같은 ID의 응답에서 reachable만 true→false로 바꾸면 이름이 복원된다.
  운영 저장이나 설정 변경은 수행하지 않았다. 이번 코딩 환경에서 컴포넌트 재현을
  직접 실행했다는 뜻은 아니다.
- 코드 확인: `[storedView]` effect가 매번 서버 값으로 draft 전체를 교체한다.
  응답 객체 변경이 로컬 편집 값을 덮어쓰는 경로가 존재한다.

## 구현 및 검증 계획

- 라우트의 agent ID를 폼의 수명 경계로 사용해 다른 ID/새 작성으로 이동하면
  draft와 검증·ID 수동 입력·저장 오류 상태를 초기화한다.
- 편집은 현재 ID와 일치하는 첫 유효 응답으로만 초기화한다. 같은 ID의 이후
  응답은 이름을 포함한 모든 미저장 필드를 보존한다.
- 새 작성은 빈 폼과 최초 `?org=` 프리셋으로 시작하며 조회 응답으로 덮어쓰지 않는다.
- 기존 node:test/tsx로 제품에서 사용하는 초기화 함수를 검증한다.
  실제 React 컴포넌트 재검증 및 PR·Ainmem 카드는 컨트롤러에 인계한다.
  배포는 담당 관리자의 `배포해` 또는 `LGTM` 이후 별도 진행한다.

## 구현 결과 및 인계

- `AgentLinkPage`의 ID별 keyed editor와 `initializeLinkedAgentDraft`로 구현 완료.
  첫 응답 대기 중에는 입력 폼을 노출하지 않고, 다른 ID의 응답은 초기화에 사용하지 않는다.
- `test/agent-link-draft.test.ts`에 초기 로드, reachable 변경 재현, 모든 필드/빈 입력
  보존, 응답 소실, 다른 ID 및 재방문, 새 작성과 org 프리셋 회귀 테스트를 추가했다.
  라우트 key와 초기화 함수 연결 검사는 소스 기반이며 실제 React 실행 검사가 아니다.
- 통과: `node --test --import tsx test/agent-link-draft.test.ts test/linked-agents-api.test.ts test/shared-agents-api.test.ts`
- 통과: `npm run typecheck`, `git diff --check`.
- 상태: **컨트롤러 검증 대기**. 준비된 React 19.2.8 환경에서 실제 컴포넌트의
  최초 로드, 같은 ID reachable 변경 후 draft 보존, A→B→A 이동, 편집→새 작성,
  새 작성→편집을 재검증한다. ID 이동 시 오류/검증 표시 및 수동 ID 상태 초기화도 확인한다.
- PR·Ainmem 카드와 버전 관리, 커밋·병합·배포는 컨트롤러에 인계한다.
  임시 renderer/진단 의존성 설치, 제품 의존성 변경, 테스트·승인 규칙 변경은 하지 않았다.
