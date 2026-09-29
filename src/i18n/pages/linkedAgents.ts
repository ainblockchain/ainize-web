/**
 * Linked agents — the form that registers an external A2A agent by URL (`AgentLinkPage`, `/agent/link`), the owner's
 * panel on the agent page, and the person's own agents page (`MyAgentsPage`, `/me/agents`).
 */
import type { Dict } from '../index';

export const linkedAgents: Dict = {
  // ── /agent/link · /agent/:id/link
  'agentLink.title': { ko: '외부 에이전트 연결', en: 'Link an external agent' },
  'agentLink.title_edit': { ko: '연결 에이전트 수정', en: 'Edit a linked agent' },
  'agentLink.lede': {
    ko: '이미 어딘가에서 돌고 있는 A2A 에이전트의 주소를 등록합니다. 이 노드가 공개 주소를 주고, 카탈로그에 올리고, 호출을 전달합니다 — 실행은 하지 않습니다. AIN Teams 는 이 카탈로그에서 에이전트를 가져옵니다.',
    en: 'Register the address of an A2A agent that already runs somewhere. This node gives it a public address, lists it in the catalogue and forwards calls to it — it does not run it. AIN Teams imports agents from this catalogue.',
  },
  'agentLink.signin.body': {
    ko: '에이전트에는 주인이 있어야 하므로 먼저 로그인합니다 — 지갑이든 AIN 계정이든 됩니다. 로그인 후 바로 이 화면으로 돌아옵니다.',
    en: 'An agent has an owner, so you sign in first — a wallet or an AIN account both work — and come straight back to this form.',
  },
  'agentLink.signin.cta': { ko: '로그인 →', en: 'Sign in →' },
  'agentLink.section.address': { ko: '주소', en: 'Address' },
  'agentLink.section.listing': { ko: '카탈로그에 보일 것', en: 'How it is listed' },
  'agentLink.field.upstream': { ko: '에이전트 주소 (upstream)', en: 'Agent address (upstream)' },
  'agentLink.field.upstream_help': {
    ko: '에이전트가 듣고 있는 http(s) 주소입니다. 공개 인터넷에서 닿아야 하고(사설망 주소는 거절됩니다), 이 주소는 공개되지 않습니다 — 사람들이 받는 것은 이 노드의 주소입니다.',
    en: 'The http(s) address where the agent listens. It must be reachable from the public internet (a private-network address is refused), and it is never published — what people get is this node’s address.',
  },
  'agentLink.field.id': { ko: '식별자', en: 'Id' },
  'agentLink.field.id_help': { ko: '공개 주소가 됩니다: /agents/{id}. 등록 후에는 바꿀 수 없습니다.', en: 'Becomes the public address: /agents/{id}. Cannot change after registering.' },
  'agentLink.field.id_fixed': { ko: '식별자는 이 에이전트의 공개 주소라 바꿀 수 없습니다.', en: 'The id is this agent’s public address and cannot change.' },
  'agentLink.field.name': { ko: '이름', en: 'Name' },
  'agentLink.field.name_help': { ko: '비워 두면 에이전트 카드의 이름을 씁니다.', en: 'Leave empty to use the name from the agent card.' },
  'agentLink.field.description': { ko: '설명', en: 'Description' },
  'agentLink.field.description_help': { ko: '비워 두면 카드의 설명을 씁니다.', en: 'Leave empty to use the card’s description.' },
  'agentLink.problem.id': { ko: '식별자는 소문자·숫자·하이픈 1–40자이고 글자나 숫자로 시작합니다.', en: 'An id is 1–40 lower-case letters, digits and hyphens, starting with a letter or digit.' },
  'agentLink.problem.id_reserved': { ko: '이 식별자는 이 사이트의 경로로 쓰여 에이전트가 가질 수 없습니다.', en: 'This id is a route on this site and cannot name an agent.' },
  'agentLink.problem.name': { ko: '이름은 80자까지입니다.', en: 'A name is at most 80 characters.' },
  'agentLink.problem.description': { ko: '설명은 500자까지입니다.', en: 'A description is at most 500 characters.' },
  'agentLink.problem.upstream': { ko: 'http:// 또는 https:// 로 시작하는 전체 주소를 적어 주세요.', en: 'Give a full address starting with http:// or https://.' },
  'agentLink.submit': { ko: '연결', en: 'Link it' },
  'agentLink.submit_edit': { ko: '저장', en: 'Save' },
  'agentLink.submitting': { ko: '카드를 확인하는 중…', en: 'Checking the card…' },
  'agentLink.done.reachable': { ko: '{name}이(가) 연결됐습니다 — 카드가 답했습니다.', en: '{name} is linked — its card answered.' },
  'agentLink.done.unreachable': {
    ko: '{name}이(가) 연결됐지만 지금은 카드가 답하지 않습니다 ({why}). 에이전트가 올라오면 카탈로그가 알아챕니다.',
    en: '{name} is linked, but its card is not answering right now ({why}). The catalogue notices when the agent comes up.',
  },
  'agentLink.api.not_signed_in': { ko: '로그인이 풀렸습니다. 다시 로그인해 주세요.', en: 'You are no longer signed in. Sign in again.' },
  'agentLink.api.invalid_request': { ko: '노드가 입력을 거절했습니다.', en: 'The node refused the input.' },
  'agentLink.api.upstream_not_public': { ko: '이 주소는 사설망을 가리킵니다. 노드는 자기 네트워크 안으로 호출하지 않습니다.', en: 'That address points into a private network. The node will not call into its own network.' },
  'agentLink.api.name_required': { ko: '카드를 못 읽어 이름을 가져올 수 없었습니다. 이름을 직접 적어 주세요.', en: 'The card could not be read, so there was no name to take. Give one.' },
  'agentLink.api.id_taken': { ko: '이 식별자는 이미 이 노드의 다른 에이전트가 쓰고 있습니다.', en: 'Another agent on this node already has this id.' },
  'agentLink.api.limit_reached': { ko: '이 노드에서 연결할 수 있는 개수를 다 썼습니다.', en: 'You have linked as many agents as this node allows.' },
  'agentLink.api.not_owner': { ko: '이 에이전트는 다른 계정이 등록했습니다.', en: 'Another account registered this agent.' },
  'agentLink.api.not_found': { ko: '이 노드에 그런 연결 에이전트가 없습니다.', en: 'No such linked agent on this node.' },
  'agentLink.api.unreachable': { ko: '노드가 답하지 않았습니다.', en: 'The node did not answer.' },
  'agentLink.api.unknown': { ko: '노드가 요청을 처리하지 못했습니다.', en: 'The node could not handle the request.' },
  'agentLink.edit.back': { ko: '에이전트로 돌아가기', en: 'Back to the agent' },
  'agentLink.edit.unreadable': { ko: '{id}을(를) 읽을 수 없습니다.', en: '{id} could not be read.' },

  // ── the owner's panel on /agent/:id for a linked agent
  'linkedOwner.lede': { ko: '이 노드에 연결한 외부 에이전트입니다. 등록한 계정에게만 보입니다.', en: 'An external agent you linked on this node. Only the account that registered it sees this.' },
  'linkedOwner.edit': { ko: '주소·이름 수정 →', en: 'Edit address or name →' },
  'linkedOwner.delete': { ko: '연결 해제', en: 'Unlink' },
  'linkedOwner.delete_confirm': {
    ko: '{name}의 연결을 해제할까요? 공개 주소가 더 답하지 않고, 이 에이전트를 가져간 워크스페이스에서는 오프라인으로 보입니다.',
    en: 'Unlink {name}? Its public address stops answering, and any workspace that imported it sees it go offline.',
  },

  // ── /me/agents
  'myAgents.title': { ko: '내 에이전트', en: 'My agents' },
  'myAgents.lede': {
    ko: '이 노드에서 내 계정이 소유한 에이전트 — 모델 위에 만든 것과 주소로 연결한 것. 등록·수정·삭제는 여기서 하고, AIN Teams 같은 워크스페이스는 이 카탈로그에서 가져갑니다.',
    en: 'Agents your account owns on this node — built on a model, or linked by address. Register, change and remove them here; a workspace such as AIN Teams imports them from this catalogue.',
  },
  'myAgents.create': { ko: '모델로 에이전트 만들기', en: 'Create an agent on a model' },
  'myAgents.link': { ko: '외부 에이전트 연결', en: 'Link an external agent' },
  'myAgents.empty': { ko: '아직 내 에이전트가 없습니다.', en: 'You have no agents here yet.' },
  'myAgents.kind.upstream': { ko: '연결', en: 'Linked' },
  'myAgents.kind.prompt': { ko: '프롬프트', en: 'Prompt' },
  'myAgents.kind.tools': { ko: '도구', en: 'Tools' },
  'myAgents.kind.handler': { ko: '핸들러', en: 'Handler' },
  'myAgents.reachable': { ko: '답함', en: 'Answering' },
  'myAgents.unreachable': { ko: '답하지 않음', en: 'Not answering' },
  'myAgents.unknown': { ko: '확인 전', en: 'Not checked yet' },
  'myAgents.address': { ko: 'A2A 주소', en: 'A2A address' },
  'myAgents.copy': { ko: '주소 복사', en: 'Copy address' },
  'myAgents.open': { ko: '열기', en: 'Open' },
  'myAgents.edit': { ko: '수정', en: 'Edit' },
  'myAgents.delete': { ko: '삭제', en: 'Delete' },
  'myAgents.delete_confirm': { ko: '{name}을(를) 삭제할까요? 공개 주소가 더 답하지 않습니다.', en: 'Delete {name}? Its public address stops answering.' },
  'myAgents.delete_failed': { ko: '삭제하지 못했습니다: {why}', en: 'It could not be deleted: {why}' },
  'myAgents.teams_hint': {
    ko: 'AIN Teams 에서는 에이전트 → 초대에서 이 목록을 그대로 봅니다. 여기 없는 것은 그쪽에도 없습니다.',
    en: 'In AIN Teams, Agents → Invite shows this same list. What is not here is not there either.',
  },
  'me.agents.link': { ko: '내 에이전트 →', en: 'My agents →' },
  'me.agents.lede': { ko: '모델 위에 만들었거나 주소로 연결한 에이전트. 워크스페이스는 여기서 가져갑니다.', en: 'Agents you built on a model or linked by address. Workspaces import them from here.' },
};
