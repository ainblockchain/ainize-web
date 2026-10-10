/**
 * Projects — a repo in an aindrive drive deployed on every push (`/projects/new`, `/projects/:id`).
 */
import type { Dict } from '../index';

export const projects: Dict = {
  // ── /projects/new
  'projects.new.title': { ko: 'ainize에 연결', en: 'Connect to ainize' },
  'projects.new.lede': {
    ko: 'aindrive 드라이브 안의 git 리포를 프로젝트로 묶습니다. 이후 push마다 노드가 그 커밋을 받아 리포의 ainize.json이 말하는 대로 — Next.js 앱, 서비스, 스크립트, 에이전트 — 빌드하고 배포 기록을 남깁니다. ainize는 리포를 보관하지 않습니다. 리포는 드라이브에 있습니다.',
    en: 'Bind a git repository in your aindrive drive as a project. From then on every push hands that commit to the node, which builds what the repo\'s ainize.json says — a Next.js app, a service, a script or an agent — and records a deployment. ainize keeps no repository; it stays in the drive.',
  },
  'projects.new.repo': { ko: '리포 URL', en: 'Repository URL' },
  'projects.new.repo_help': { ko: 'https://aindrive.ainetwork.ai/<org>/git/<repo> 형식', en: 'https://aindrive.ainetwork.ai/<org>/git/<repo>' },
  'projects.new.repo_bad': { ko: 'aindrive git URL이 아닙니다 — /<org>/git/<repo> 가 있어야 합니다.', en: 'Not an aindrive git URL — it needs /<org>/git/<repo>.' },
  'projects.new.branch': { ko: '브랜치', en: 'Branch' },
  'projects.new.token': { ko: '배포 토큰 (선택)', en: 'Deploy token (optional)' },
  'projects.new.token_help': {
    ko: '비공개 리포라면 노드가 clone할 때 쓸 aindrive 토큰(drives:read 권한의 aind_aat_… 계정 토큰, 또는 세션 JWT)을 넣습니다. 암호화되어 저장되며 다시 보여 주지 않습니다. 공개 리포는 비워 두세요.',
    en: 'For a private repo: an aindrive token the node clones with (an aind_aat_… account token with drives:read, or a session JWT). Stored encrypted, never shown again. Leave empty for a public repo.',
  },
  'projects.new.create': { ko: '프로젝트 만들기', en: 'Create project' },
  'projects.new.creating': { ko: '만드는 중…', en: 'Creating…' },
  'projects.new.from_aindrive': { ko: 'aindrive에서 왔습니다 — 만들어지면 드라이브가 push 훅 비밀값을 받아 저장하고, 드라이브 페이지로 돌아갑니다.', en: 'Opened from aindrive — once created, the drive stores the push-hook secret and you are taken back to the drive page.' },
  'projects.new.connecting': { ko: 'aindrive에 훅 비밀값을 전달하는 중…', en: 'Handing the hook secret to aindrive…' },
  'projects.new.connected': { ko: '연결됐습니다. 이제 {branch} 에 push하면 배포됩니다. 드라이브로 돌아갑니다…', en: 'Connected. A push to {branch} now deploys. Returning to the drive…' },
  'projects.new.connect_failed': { ko: 'aindrive가 비밀값을 받지 못했습니다 ({why}). 아래 값을 드라이브의 리포 설정에 직접 넣으세요 — 다시 보여 주지 않습니다.', en: 'aindrive did not take the secret ({why}). Paste the values below into the repo\'s settings in the drive — they will not be shown again.' },
  'projects.new.secret_once': { ko: '웹훅 비밀값 — 지금 한 번만 보여 줍니다', en: 'Webhook secret — shown only now' },
  'projects.new.hook_url': { ko: '훅 URL', en: 'Hook URL' },
  'projects.new.manual_help': { ko: 'aindrive 밖의 git 호스트라면 push 뒤에 이 URL로 서명된 훅을 보내면 됩니다 (docs: ainize.json으로 리포 배포하기).', en: 'A git host outside aindrive posts the signed hook to this URL after each push (docs: Deploy a repo with ainize.json).' },
  'projects.new.open_project': { ko: '프로젝트 열기', en: 'Open the project' },
  'projects.new.back_to_drive': { ko: '드라이브로 돌아가기', en: 'Back to the drive' },
  'projects.new.taken': { ko: '이 리포와 브랜치는 이미 이 노드의 프로젝트입니다.', en: 'This repo and branch is already a project on this node.' },
  'projects.new.taken_open': { ko: '기존 프로젝트 열기', en: 'Open the existing project' },
  'projects.new.failed': { ko: '만들지 못했습니다: {why}', en: 'Could not create it: {why}' },
  'projects.new.sign_in': { ko: '프로젝트를 만들려면 로그인하세요 (AIN 계정).', en: 'Sign in (AIN account) to create a project.' },

  // ── /projects/:id
  'projects.page.title': { ko: '프로젝트', en: 'Project' },
  'projects.page.not_found': { ko: '이 노드에 그런 프로젝트가 없거나, 당신의 것이 아닙니다.', en: 'No such project on this node, or it is not yours.' },
  'projects.page.repo': { ko: '리포', en: 'Repository' },
  'projects.page.branch': { ko: '브랜치', en: 'Branch' },
  'projects.page.kind': { ko: '종류', en: 'Kind' },
  'projects.page.kind_pending': { ko: '첫 push 뒤 ainize.json이 정합니다', en: 'decided by ainize.json on the first push' },
  'projects.page.deployments': { ko: '배포', en: 'Deployments' },
  'projects.page.no_deployments': { ko: '아직 배포가 없습니다. {branch} 에 push하면 여기에 나타납니다.', en: 'No deployments yet. Push to {branch} and it appears here.' },
  'projects.page.inspect': { ko: '로그', en: 'Inspect' },
  'projects.page.hide_log': { ko: '로그 닫기', en: 'Hide log' },
  'projects.page.visit': { ko: '열기', en: 'Visit' },
  'projects.page.log_empty': { ko: '(아직 로그가 없습니다)', en: '(no log yet)' },
  'projects.page.delete': { ko: '프로젝트 삭제', en: 'Delete project' },
  'projects.page.delete_confirm': { ko: '"{name}" 을 삭제할까요? 배포 기록과 로그가 함께 지워지고, 실행 중인 서비스는 멈춥니다. 리포는 드라이브에 그대로 남습니다.', en: 'Delete "{name}"? Its deployments and logs go with it and a running service stops. The repository stays in the drive.' },
  'projects.page.deleted': { ko: '삭제했습니다.', en: 'Deleted.' },
  'projects.page.by': { ko: '{who} 의 push', en: 'pushed by {who}' },
  'projects.page.exit': { ko: '종료 코드 {code}', en: 'exit {code}' },
  'projects.page.pending_hint': { ko: '대기 중 — 같은 프로젝트의 앞선 배포가 끝나면 시작합니다.', en: 'Queued — starts when the project\'s earlier deployment finishes.' },

  'projects.status.idle': { ko: '대기', en: 'Idle' },
  'projects.status.queued': { ko: '대기열', en: 'Queued' },
  'projects.status.building': { ko: '빌드 중', en: 'Building' },
  'projects.status.ready': { ko: '준비됨', en: 'Ready' },
  'projects.status.error': { ko: '오류', en: 'Error' },
  'projects.kind.nextjs': { ko: 'Next.js', en: 'Next.js' },
  'projects.kind.service': { ko: '서비스', en: 'Service' },
  'projects.kind.script': { ko: '스크립트', en: 'Script' },
  'projects.kind.agent': { ko: '에이전트', en: 'Agent' },

  // ── /me/projects (the list on the person's page)
  'projects.mine.title': { ko: '내 프로젝트', en: 'My projects' },
  'projects.mine.empty': { ko: '아직 프로젝트가 없습니다. aindrive 드라이브의 git 리포에서 "ainize에 연결"을 누르세요.', en: 'No projects yet. Press "Connect to ainize" on a git repo in your aindrive drive.' },
  'projects.mine.new': { ko: '리포 연결', en: 'Connect a repo' },

  'projects.api.not_signed_in': { ko: '로그인이 필요합니다', en: 'sign in first' },
  'projects.api.invalid_request': { ko: '요청이 올바르지 않습니다', en: 'the request was not valid' },
  'projects.api.repo_taken': { ko: '이미 프로젝트인 리포입니다', en: 'already a project' },
  'projects.api.limit': { ko: '프로젝트 한도에 닿았습니다', en: 'project limit reached' },
  'projects.api.not_found': { ko: '찾을 수 없습니다', en: 'not found' },
  'projects.api.network': { ko: '노드에 닿지 못했습니다', en: 'could not reach the node' },
  'projects.api.unknown': { ko: '알 수 없는 오류', en: 'unknown error' },
};
