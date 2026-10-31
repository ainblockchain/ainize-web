/** `/me` — what belongs to the person, as distinct from what belongs to the node they are looking at. */
import type { Dict } from '../index';

export const me: Dict = {
  'me.title': { ko: '내 페이지', en: 'My page' },
  'me.lede': {
    ko: '내 주소로 된 것들입니다. 이 노드를 운영하는지와는 무관합니다.',
    en: 'The things that are yours, whether or not you run this node.',
  },

  'me.identity': { ko: '내 계정', en: 'Your account' },
  'me.identity.address': { ko: '지갑 주소', en: 'Wallet address' },
  'me.identity.google': { ko: 'Google 계정', en: 'Google account' },
  'me.identity.none': { ko: '연결된 지갑이 없습니다.', en: 'No wallet connected.' },
  'me.identity.sso': { ko: 'AIN 계정', en: 'AIN account' },
  'me.identity.orgs': { ko: '조직: {orgs}', en: 'Organizations: {orgs}' },
  'me.keys.scope': { ko: '범위', en: 'Scope' },
  'me.keys.personal': { ko: '개인', en: 'Personal' },
  'me.keys.disabled': { ko: '일시 중지됨', en: 'suspended' },
  'me.keys.for': { ko: '발급 대상', en: 'Key for' },
  'me.keys.org_hint': {
    ko: '조직 키는 조직이 계정을 정지하면 멈추고, 퇴사 처리되면 폐기됩니다. 개인 키는 조직과 상관없이 유지됩니다.',
    en: 'An organization key stops when the organization suspends your account and is deleted when you leave it. A personal key stays yours either way.',
  },

  'me.keys.title': { ko: 'API 키', en: 'API keys' },
  'me.keys.lede': {
    ko: '이 키로 이 노드의 모델을 코드에서 호출합니다. 노드는 해시만 저장하므로 발급 순간에만 볼 수 있습니다.',
    en: 'These call this node’s models from your code. The node stores a hash, so a key is visible only when it is created.',
  },
  'me.keys.held.checking': { ko: '키 상태를 확인해야 모델 실행에 사용할 수 있습니다.', en: 'Confirm this key’s current status before using it for model calls.' },
  'me.keys.held.disabled': { ko: '이 키는 사용이 중지되었습니다. 모델 실행에 사용하지 않습니다.', en: 'This key is disabled and will not be used for model calls.' },
  'me.keys.held.revoked': { ko: '이 키는 더 이상 목록에 없습니다.', en: 'This key is no longer in your key list.' },
  'me.keys.none': { ko: '아직 키가 없습니다.', en: 'No keys yet.' },
  'me.keys.create': { ko: '키 발급', en: 'Create a key' },
  'me.keys.creating': { ko: '발급 중…', en: 'Creating…' },
  'me.keys.created': { ko: '발급됨', en: 'Created' },
  'me.keys.name': { ko: '키 이름', en: 'Key name' },
  'me.keys.name_placeholder': { ko: '예: 고객지원 봇 운영용', en: 'e.g. Support bot production' },
  'me.keys.name_hint': { ko: '어디에 사용할 키인지 이름을 붙이세요. 최대 60자입니다.', en: 'Name the app or purpose this key is for. Up to 60 characters.' },
  'me.keys.name_duplicate': { ko: '같은 이름의 키가 있습니다. 용도를 구분할 수 있는 다른 이름을 입력하세요.', en: 'A key already has this name. Choose another name to distinguish its purpose.' },
  'me.keys.label': { ko: '이름', en: 'Label' },
  'me.keys.loading': { ko: '키를 불러오는 중…', en: 'Loading keys…' },
  'me.keys.revoking': { ko: '폐기 중…', en: 'Revoking…' },
  'me.keys.revoked': { ko: '{label} 키를 폐기했습니다.', en: 'Revoked key: {label}.' },
  'me.keys.invalid': { ko: '키 목록을 확인할 수 없습니다. 다시 불러와 주세요.', en: 'The key list could not be verified. Reload it before making changes.' },
  'me.keys.receipt': { ko: '응답이 선택한 키와 일치하지 않습니다.', en: 'The response does not match the selected key.' },
  'me.keys.create_unknown': { ko: '발급 결과를 확인하지 못했습니다. 키가 생성되었을 수 있으니 목록을 확인하세요: {why}', en: 'Creation could not be confirmed. A key may have been created; check the list: {why}' },
  'me.keys.revoke_unknown': { ko: '폐기 결과를 확인하지 못했습니다. 목록을 다시 확인하세요: {why}', en: 'Revocation could not be confirmed. Reload the key list: {why}' },
  'me.keys.revoke_failed': { ko: '폐기 결과를 확인하지 못했습니다: {why}', en: 'Revocation could not be confirmed: {why}' },
  'me.keys.copy_failed': { ko: '복사하지 못했습니다. 위의 키를 선택해 직접 복사해 주세요.', en: 'Could not copy. Select the key above and copy it manually.' },
  'me.keys.revoke': { ko: '폐기', en: 'Revoke' },
  'me.keys.once': {
    ko: '이 값은 다시 보여줄 방법이 없습니다. 안전한 곳에 옮겨두세요 — 로그아웃하거나 계정·노드를 바꾸거나 이 탭을 닫으면 지워집니다.',
    en: 'There is no way to show this again. Put it somewhere safe — it is cleared when you sign out, switch accounts or nodes, or close this tab.',
  },
  'me.keys.issued': { ko: '이 탭에 보관된 키', en: 'Key saved in this tab' },
  'me.keys.copy': { ko: '복사', en: 'Copy' },
  'me.keys.copied': { ko: '복사됨', en: 'Copied' },
  'me.keys.forget': { ko: '옮겼습니다, 화면에서 지우기', en: 'Saved it — clear from screen' },
  'me.keys.models': { ko: '모델 페이지에서 눌러보기 →', en: 'Try it on the Models page →' },
  'me.keys.failed': { ko: '실패: {why}', en: 'Failed: {why}' },

  'me.nodes.title': { ko: '내 노드', en: 'Your nodes' },
  'me.nodes.lede': {
    ko: '내 주소가 운영자로 등록된 노드입니다 — 여기 노드가 아니어도 됩니다.',
    en: 'Nodes that list your address as an operator — including ones that are not this one.',
  },
  'me.nodes.wallet_needed': { ko: '노드 목록은 운영자로 등록된 지갑 주소로 조회합니다. 지갑을 연결하면 확인할 수 있습니다.', en: 'Nodes are listed by their operator wallet address. Connect that wallet to see your nodes.' },
  'me.nodes.none': {
    ko: '아직 없습니다. 노드를 운영하면 여기에 나타납니다.',
    en: 'None yet. A node appears here once it lists you as an operator.',
  },
  'me.nodes.link': { ko: '내 노드 전체 보기 →', en: 'See all your nodes →' },

  'me.record.title': { ko: '공개 기록', en: 'The public record' },
  'me.record.lede': {
    ko: '판매와 검증은 누구나 감사할 수 있도록 공개돼 있습니다. 노드 지도도 함께 보세요.',
    en: 'Sales and verifications are public so anybody can audit them. The map of nodes is there too.',
  },
  'me.record.ledger': { ko: '공개 기록 →', en: 'Public record →' },
  'me.record.network': { ko: '네트워크 →', en: 'Network →' },

  'me.operator.title': { ko: '이 노드 운영', en: 'Running this node' },
  'me.operator.lede': {
    ko: '이 노드의 운영자이므로 설정·지갑·런타임 화면에 접근할 수 있습니다.',
    en: 'You are an operator of this node, so its settings, wallet and runtime are open to you.',
  },
  'me.operator.account': { ko: '노드 설정 →', en: 'Node settings →' },
};
