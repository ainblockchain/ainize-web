/** The AinCode page (`/aincode`): every AinCode session the person has, by workspace and repository. */
import type { Dict } from '../index';

export const aincode: Dict = {
  'nav.aincode': { ko: 'AinCode', en: 'AinCode' },
  'aincode.title': { ko: 'AinCode 세션', en: 'AinCode sessions' },
  'aincode.workspace.personal': { ko: '개인 작업 공간', en: 'Personal workspace' },
  'aincode.workspace.org': { ko: '{name} 조직 작업 공간', en: '{name} organization workspace' },
  'aincode.workspace.running': { ko: '실행 중', en: 'Running' },
  'aincode.workspace.stopped': { ko: '중지됨 — 마지막으로 본 목록', en: 'Stopped — last seen list' },
  'aincode.workspace.working': { ko: '{n}개 작업 중', en: '{n} working' },
  'aincode.newSession': { ko: '새 세션', en: 'New session' },
  'aincode.open': { ko: '열기', en: 'Open' },
  'aincode.col.session': { ko: '세션', en: 'Session' },
  'aincode.col.status': { ko: '상태', en: 'Status' },
  'aincode.col.branch': { ko: '브랜치', en: 'Branch' },
  'aincode.col.updated': { ko: '마지막 활동', en: 'Last activity' },
  'aincode.status.working': { ko: '작업 중', en: 'Working' },
  'aincode.status.idle': { ko: '대기', en: 'Idle' },
  'aincode.status.unknown': { ko: '알 수 없음', en: 'Unknown' },
  'aincode.repo.noRepo': { ko: '저장소 없음', en: 'No repository' },
  'aincode.misplaced': { ko: '조직 저장소를 개인 작업 공간에서 작업 중 — 조직 작업 공간에서 열어 주세요', en: "An organization's repository in the personal workspace — open it in the organization workspace" },
  'aincode.empty': { ko: '아직 AinCode 세션이 없습니다.', en: 'No AinCode sessions yet.' },
  'aincode.start': { ko: 'AinCode 시작하기', en: 'Start AinCode' },
  'aincode.signin': { ko: '로그인하면 내 AinCode 세션을 볼 수 있습니다.', en: 'Sign in to see your AinCode sessions.' },
  'aincode.signin.cta': { ko: '로그인', en: 'Sign in' },
  'aincode.failed': { ko: 'AinCode 세션을 불러오지 못했습니다.', en: 'Could not load your AinCode sessions.' },
  'aincode.retry': { ko: '다시 불러오기', en: 'Try again' },
};
