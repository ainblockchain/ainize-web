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

  'me.keys.title': { ko: 'API 키', en: 'API keys' },
  'me.keys.lede': {
    ko: '이 키로 이 노드의 모델을 코드에서 호출합니다. 노드는 해시만 저장하므로 발급 순간에만 볼 수 있습니다.',
    en: 'These call this node’s models from your code. The node stores a hash, so a key is visible only when it is created.',
  },
  'me.keys.none': { ko: '아직 키가 없습니다.', en: 'No keys yet.' },
  'me.keys.create': { ko: '키 발급', en: 'Create a key' },
  'me.keys.creating': { ko: '발급 중…', en: 'Creating…' },
  'me.keys.created': { ko: '발급됨', en: 'Created' },
  'me.keys.label': { ko: '이름', en: 'Label' },
  'me.keys.revoke': { ko: '폐기', en: 'Revoke' },
  'me.keys.once': {
    ko: '이 값은 지금만 보입니다 — 다시 보여줄 방법이 없습니다. 안전한 곳에 옮겨두세요.',
    en: 'This is the only time it is shown — there is no way to show it again. Put it somewhere safe.',
  },
  'me.keys.models': { ko: '모델 페이지에서 눌러보기 →', en: 'Try it on the Models page →' },
  'me.keys.failed': { ko: '실패: {why}', en: 'Failed: {why}' },

  'me.nodes.title': { ko: '내 노드', en: 'Your nodes' },
  'me.nodes.lede': {
    ko: '내 주소가 운영자로 등록된 노드입니다 — 여기 노드가 아니어도 됩니다.',
    en: 'Nodes that list your address as an operator — including ones that are not this one.',
  },
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
