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
  'sharing.owner.unsupported': { ko: '공개 범위 편집 기능을 확인할 수 없습니다.', en: 'Visibility editing support could not be verified.' },
  'sharing.owner.unknown': { ko: '확인되지 않음', en: 'Not verified' },
  'sharing.owner.read_failed': { ko: '현재 공개 범위와 편집 권한을 확인하지 못했습니다. 현재 계정과 노드 지원 여부를 확인해 주세요.', en: 'Current visibility and editing permission could not be verified. Check the current account and node support.' },
  'sharing.owner.changed': { ko: '계정 또는 에이전트 설정이 바뀌었습니다. 초안은 유지했으며 최신 설정을 다시 확인해야 합니다.', en: 'The account or agent settings changed. Your draft is preserved; review the latest settings.' },
  'sharing.owner.not_saved': { ko: '저장을 완료하지 못했습니다. 권한과 현재 설정을 다시 확인해 주세요.', en: 'The save did not complete. Check permissions and current settings again.' },
  'sharing.owner.unconfirmed': { ko: '저장 결과를 확인하지 못했습니다. 요청을 반복하지 않았습니다. 현재 범위를 조회해도 이번 요청의 완료가 확인되는 것은 아닙니다.', en: 'The save result is unconfirmed. The request was not repeated. Reading current visibility does not establish this request’s outcome.' },
  'sharing.owner.check': { ko: '현재 범위 조회', en: 'Check current visibility' },
  'sharing.owner.reload': { ko: '초안을 버리고 최신 설정 가져오기', en: 'Discard draft and load latest settings' },

  // ── the owner's "Address name" (agent alias) control on the agent page
  'agentAlias.title': { ko: '주소 이름', en: 'Address name' },
  'agentAlias.none': { ko: '없음 — 식별자로만 열립니다', en: 'None — opened by its id only' },
  'agentAlias.set': { ko: '정하기', en: 'Set' },
  'agentAlias.change': { ko: '바꾸기', en: 'Change' },
  'agentAlias.clear': { ko: '지우기', en: 'Remove' },
  'agentAlias.save': { ko: '저장', en: 'Save' },
  'agentAlias.cancel': { ko: '취소', en: 'Cancel' },
  'agentAlias.help': {
    ko: '영문 소문자·숫자·하이픈, 40자까지. 식별자 {id}는 그대로이고, 이 이름으로도 열리고 호출됩니다.',
    en: 'Lower-case letters, digits and hyphens, up to 40. The id {id} stays; this name opens and calls the same agent.',
  },
  'agentAlias.taken': { ko: '다른 에이전트가 쓰는 이름입니다.', en: 'Another agent already uses that name.' },
  'agentAlias.unsupported': { ko: '이 노드는 주소 이름을 지원하지 않습니다.', en: 'This node does not support address names.' },
  'agentAlias.read_failed': { ko: '현재 주소 설정을 확인하지 못했습니다. 다시 불러와 주세요.', en: 'Could not verify the current address settings. Load them again.' },
  'agentAlias.not_saved': { ko: '주소 변경 요청이 거절됐습니다. 현재 설정과 권한을 확인해 주세요.', en: 'The address change was refused. Check the current settings and permissions.' },
  'agentAlias.changed': { ko: '에이전트나 주소 설정이 변경됐습니다. 입력 내용은 보존했습니다.', en: 'The agent or its address settings changed. Your draft has been kept.' },
  'agentAlias.reload': { ko: '입력 취소 후 최신 설정 불러오기', en: 'Discard draft and load latest settings' },
  'agentAlias.unconfirmed': { ko: '주소 변경 결과를 확인하지 못했습니다. 중복 변경을 막기 위해 다시 저장할 수 없습니다. 현재 주소 조회만으로 이전 요청의 완료 여부는 알 수 없습니다.', en: 'The address change could not be confirmed. Saving again is disabled to avoid a duplicate change. Reading the current address does not prove the earlier request completed.' },
  'agentAlias.check': { ko: '현재 주소 확인', en: 'Check current address' },
  'agentAlias.recorded': { ko: '이전 기록의 주소 이름:', en: 'Address name in the earlier record:' },
  'agentAlias.confirm': { ko: '이 에이전트에 연결', en: 'Connect to this agent' },
  'agentAlias.unverified': { ko: '이전 주소 이름이 현재 에이전트에 연결된 것인지 확인할 수 없어 사용을 중지했습니다. 이 에이전트에 다시 연결하거나 주소 이름을 지울 수 있습니다.', en: 'This earlier address name is inactive because its connection to the current agent cannot be verified. You can connect it to this agent or remove it.' },
  'agentAlias.reviewed': { ko: '마지막으로 확인한 주소:', en: 'Last verified address:' },
  'agentAlias.remove_confirm': { ko: '주소 이름 {alias}을 지울까요? 에이전트는 {id} 주소로 계속 열 수 있습니다.', en: 'Remove the address name {alias}? The agent remains available at {id}.' },
  'agentAlias.failed': { ko: '저장하지 못했습니다: {why}', en: 'It could not be saved: {why}' },

  // ── the marketplace chips
  'explore.agents.filter.all': { ko: '공개', en: 'Public' },
  'explore.agents.filter.mine': { ko: '내 것', en: 'Mine' },
  'explore.agents.filter.org': { ko: '내 조직', en: 'My organization' },
  'explore.agents.filter.org_pick': { ko: '조직: {org}', en: 'Organization: {org}' },
  'explore.agents.invalid_page': { ko: '에이전트 목록의 응답을 확인할 수 없습니다. 다시 불러와 주세요.', en: 'The agent list response could not be verified. Reload the list.' },
  'explore.agents.previous_page': { ko: '이전 에이전트', en: 'Previous agents' },
  'explore.agents.next_page': { ko: '다음 에이전트', en: 'Next agents' },
  'explore.agents.org_unsupported': {
    ko: '이 노드는 조직 에이전트 목록을 지원하지 않습니다.',
    en: 'This node does not support organization agent lists.',
  },
  'explore.agents.org_label': { ko: '조직', en: 'Organization' },
  'explore.agents.org_manage': { ko: '조직 관리', en: 'Manage organization' },
  'explore.agents.count_in': { ko: '{name} 에이전트 {n}개', en: '{n} agents in {name}' },
  'explore.agents.count_in_one': { ko: '{name} 에이전트 1개', en: '1 agent in {name}' },
  'explore.agents.count_mine': { ko: '내 에이전트 {n}개', en: '{n} of your agents' },
  'explore.agents.count_mine_one': { ko: '내 에이전트 1개', en: '1 of your agents' },
  'explore.agents.count_public': { ko: '공개 에이전트 {n}개', en: '{n} public agents' },
  'explore.agents.count_public_one': { ko: '공개 에이전트 1개', en: '1 public agent' },
  'explore.agents.org_none': { ko: '아직 속한 조직이 없습니다.', en: 'You are not in an organization yet.' },
  'explore.agents.signin_for_scope': { ko: '로그인하면 내 에이전트와 조직의 에이전트를 볼 수 있습니다.', en: 'Sign in to see your own and your organization’s agents.' },
  'explore.agents.empty_mine': { ko: '내 에이전트가 아직 없습니다.', en: 'You have no agents here yet.' },
  'explore.agents.empty_org': { ko: '조직에 공유된 에이전트가 아직 없습니다.', en: 'No agent is shared with your organization yet.' },
  'explore.agents.make.create': { ko: '모델로 에이전트 만들기', en: 'Create an agent on a model' },
  'explore.agents.make.link': { ko: 'URL로 에이전트 연결', en: 'Link an agent by URL' },

  // ── the agent page
  'agentPage.fact.visibility': { ko: '공개 범위', en: 'Visibility' },
  'agentPage.visibility.org_with': { ko: '조직 {org}', en: 'organization {org}' },
  'agentPage.badge.org_help': { ko: '조직 구성원에게만 나열되는 에이전트입니다.', en: 'Listed only to members of its organization.' },
  'agentPage.badge.private_help': { ko: '만든 사람에게만 나열되는 에이전트입니다.', en: 'Listed only to its owner.' },
  'agentPage.badge.unlisted_help': { ko: '어떤 목록에도 나오지 않는 에이전트입니다. 식별자를 알면 호출할 수 있습니다.', en: 'In no listing; callable by anyone who holds the id.' },
};
