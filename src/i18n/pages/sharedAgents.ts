/**
 * Shared agents — who may see an agent (`visibility`), the organization an `org` agent is shared with, the filter
 * chips on the agents marketplace, and the owner's control to change it (shared-agent registry, contract 1.0).
 */
import type { Dict } from '../index';

export const sharedAgents: Dict = {
  // ── the four visibilities, as a select shows them and as a badge names them
  'sharing.visibility.public': { ko: '공개', en: 'Public' },
  'sharing.visibility.org': { ko: '조직', en: 'Organization' },
  'sharing.visibility.private': { ko: '비공개', en: 'Private' },
  'sharing.visibility.unlisted': { ko: '링크만', en: 'Unlisted' },
  'sharing.visibility.public.help': { ko: '모두에게 나열됩니다. 지금까지의 모든 에이전트가 이랬습니다.', en: 'Listed to everyone — what every agent was until now.' },
  'sharing.visibility.org.help': { ko: '고른 조직의 구성원에게만 나열됩니다. AIN Teams 등 조직의 다른 제품에도 같은 목록으로 나타납니다.', en: 'Listed only to members of the organization you pick — and in the organization’s other products (AIN Teams) as the same list.' },
  'sharing.visibility.private.help': { ko: '나에게만 나열됩니다.', en: 'Listed to you alone.' },
  'sharing.visibility.unlisted.help': { ko: '어떤 목록에도 나오지 않지만, 식별자를 아는 사람은 호출할 수 있습니다.', en: 'In no listing, but anyone who holds the id can call it.' },
  'sharing.wire_note': {
    ko: '공개 범위는 목록에만 적용됩니다. A2A 주소는 인증을 보내지 않으므로, 주소를 아는 사람은 누구든 호출할 수 있습니다.',
    en: 'Visibility is about listing, not the wire: A2A sends no authentication, so anyone who has the address can call it.',
  },

  // ── the form fields
  'sharing.field.visibility': { ko: '누가 볼 수 있나', en: 'Who can see it' },
  'sharing.field.org': { ko: '조직', en: 'Organization' },
  'sharing.field.org_pick': { ko: '조직을 고르세요', en: 'Pick an organization' },
  'sharing.field.org_help': { ko: 'AIN 계정이 속한 조직 중 하나입니다.', en: 'One of the organizations your AIN account is in.' },
  'sharing.org_needs_sso': {
    ko: '조직에 공유하려면 AIN 계정으로 로그인해야 합니다. 지갑은 어느 조직에도 속하지 않습니다.',
    en: 'Sharing with an organization needs an AIN account sign-in. A wallet belongs to no organization.',
  },
  'sharing.org_none': { ko: 'AIN 계정이 어느 조직에도 속하지 않습니다.', en: 'Your AIN account is in no organization.' },
  'sharing.err.org_needs_sso': { ko: '조직 공유는 AIN 계정으로 로그인했을 때만 고를 수 있습니다.', en: 'Organization sharing needs an AIN account sign-in.' },
  'sharing.err.org_required': { ko: '공유할 조직을 고르세요.', en: 'Pick the organization to share with.' },
  'sharing.err.org_not_member': { ko: '이 계정이 속하지 않은 조직입니다.', en: 'Your account is not in that organization.' },

  // ── the owner's control on the agent page
  'sharing.owner.title': { ko: '공개 범위', en: 'Visibility' },
  'sharing.owner.current': { ko: '지금: {visibility}', en: 'Now: {visibility}' },
  'sharing.owner.shared_org': { ko: '조직에 공유됨', en: 'Shared with organization' },
  'sharing.owner.current_org': { ko: '지금: 조직 {org}에 공유', en: 'Now: shared with organization {org}' },
  'sharing.owner.change': { ko: '바꾸기', en: 'Change' },
  'sharing.owner.save': { ko: '저장', en: 'Save' },
  'sharing.owner.cancel': { ko: '취소', en: 'Cancel' },
  'sharing.owner.saved': { ko: '공개 범위를 바꿨습니다.', en: 'Visibility changed.' },
  'sharing.owner.failed': { ko: '바꾸지 못했습니다: {why}', en: 'It could not be changed: {why}' },
  'sharing.owner.unsupported': { ko: '이 노드는 공개 범위를 지원하지 않습니다 — 모든 에이전트가 공개입니다.', en: 'This node does not support visibility — every agent on it is public.' },

  // ── the marketplace chips
  'explore.agents.filter.label': { ko: '보기', en: 'Show' },
  'explore.agents.filter.all': { ko: '전체', en: 'All' },
  'explore.agents.filter.mine': { ko: '내 것', en: 'Mine' },
  'explore.agents.filter.org': { ko: '내 조직', en: 'My organization' },
  'explore.agents.filter.org_pick': { ko: '조직: {org}', en: 'Organization: {org}' },
  'explore.agents.org_unsupported': {
    ko: '이 노드는 조직 공유를 아직 지원하지 않아 공개 목록을 보여 줍니다.',
    en: 'This node does not support organization sharing yet, so this is the public list.',
  },
  'explore.agents.org_needs_sso': {
    ko: '내 조직의 에이전트는 AIN 계정으로 로그인했을 때 보입니다.',
    en: 'Your organization’s agents show when you sign in with an AIN account.',
  },
  'explore.agents.signin_for_scope': { ko: '로그인하면 내 에이전트와 조직의 에이전트를 볼 수 있습니다.', en: 'Sign in to see your own and your organization’s agents.' },
  'explore.agents.empty_mine': { ko: '내 에이전트가 아직 없습니다.', en: 'You have no agents here yet.' },
  'explore.agents.empty_org': { ko: '조직에 공유된 에이전트가 아직 없습니다.', en: 'No agent is shared with your organization yet.' },
  'explore.agents.make.create': { ko: '모델로 에이전트 만들기', en: 'Create an agent on a model' },
  'explore.agents.make.link': { ko: 'URL로 에이전트 연결', en: 'Link an agent by URL' },
  'explore.agents.make.mine': { ko: '내 에이전트', en: 'My agents' },

  // ── the agent page
  'agentPage.fact.visibility': { ko: '공개 범위', en: 'Visibility' },
  'agentPage.visibility.org_with': { ko: '조직 {org}', en: 'organization {org}' },
  'agentPage.badge.org_help': { ko: '조직 구성원에게만 나열되는 에이전트입니다.', en: 'Listed only to members of its organization.' },
  'agentPage.badge.private_help': { ko: '만든 사람에게만 나열되는 에이전트입니다.', en: 'Listed only to its owner.' },
  'agentPage.badge.unlisted_help': { ko: '어떤 목록에도 나오지 않는 에이전트입니다. 식별자를 알면 호출할 수 있습니다.', en: 'In no listing; callable by anyone who holds the id.' },
};
