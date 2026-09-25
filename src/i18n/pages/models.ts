/** The Models page — what this node serves, a place to press it, and the code to take away. */
import type { Dict } from '../index';

export const models: Dict = {
  'models.title': { ko: '모델', en: 'Models' },
  'models.lede': {
    ko: '이 노드가 LLM API로 서빙하는 모델입니다. 아래에서 바로 눌러볼 수 있고 — 키도 예치도 필요 없습니다 — 같은 호출을 코드로 복사해 갈 수 있습니다.',
    en: 'What this node serves over the LLM API. Press one below — no key, no deposit — and take the same call away as code.',
  },

  'models.modality.chat': { ko: '대화', en: 'Chat' },
  'models.modality.transcription': { ko: '음성 인식', en: 'Speech to text' },
  'models.modality.image': { ko: '이미지 생성', en: 'Images' },
  'models.available': { ko: '응답 중', en: 'answering' },
  'models.unavailable': { ko: '응답 없음', en: 'not answering' },
  'models.select': { ko: '선택', en: 'Select' },
  'models.selected': { ko: '선택됨', en: 'Selected' },

  'models.empty.title': { ko: '이 노드는 API로 모델을 서빙하지 않습니다', en: 'This node serves no models over the API' },
  'models.empty.body': {
    ko: '운영자가 config.json에 backends 블록을 넣으면 여기에 나타납니다. 무엇이 설정되었는지만 알리고 무엇이 떠 있는지 추측하지 않으므로, 이 목록은 비어 있을 수 있습니다.',
    en: 'It appears here once an operator adds a backends block to config.json. A node advertises what was configured rather than guessing what happens to be running, so this list can be empty.',
  },
  'models.outdated.title': { ko: '이 노드는 아직 모델 목록을 알리지 않습니다', en: 'This node does not publish a model list yet' },
  'models.outdated.body': {
    ko: '노드는 정상 응답 중이지만, 이 목록을 제공하는 라우트가 없는 버전입니다. 운영자가 노드를 올리면 여기에 나타납니다 — 모델을 서빙하지 않는다는 뜻은 아닙니다.',
    en: 'The node is answering, but it is running a build from before this list existed. It appears here once the operator updates — which is not the same as serving no models.',
  },
  'models.offline.title': { ko: '이 노드가 응답하지 않습니다', en: 'This node is not answering' },
  'models.offline.body': {
    ko: '모델 목록을 가져오지 못했습니다. 노드가 내려갔거나 이 사이트에서 닿지 못하는 상태입니다 — 서빙하는 모델이 없다는 뜻은 아닙니다.',
    en: 'The model list could not be fetched. The node is down or unreachable from this site — which is not the same as serving nothing.',
  },

  'models.try.title': { ko: '눌러보기', en: 'Try it' },
  'models.try.free': { ko: '무료로 시도할 수 있습니다. 남은 횟수 {n}회.', en: 'Free to try. {n} tries left this hour.' },
  'models.try.prompt': { ko: '프롬프트', en: 'Prompt' },
  'models.try.audio': { ko: '오디오 파일', en: 'Audio file' },
  'models.try.run': { ko: '실행', en: 'Run' },
  'models.try.running': { ko: '실행 중…', en: 'Running…' },
  'models.try.answer': { ko: '답변', en: 'Answer' },
  'models.try.spent': {
    ko: '이번 시간의 무료 횟수를 다 썼습니다. {at}에 다시 채워집니다 — 기다리거나, 예치하고 /v1을 직접 호출하세요.',
    en: 'The free tries for this hour are used up. They refill at {at} — wait, or deposit and call /v1 yourself.',
  },
  'models.try.failed': { ko: '실행하지 못했습니다: {why}', en: 'That did not run: {why}' },
  'models.try.unavailable': { ko: '이 모델의 백엔드가 지금 응답하지 않습니다.', en: 'This model’s backend is not answering right now.' },

  'models.key.title': { ko: 'API 키', en: 'API key' },
  'models.key.none': {
    ko: '키가 있으면 아래 코드에 바로 채워집니다. 지갑으로 로그인한 뒤 발급받으세요 — 개인키는 이 기기를 떠나지 않습니다.',
    en: 'A key gets written straight into the code below. Sign in with your wallet and create one — your private key never leaves this device.',
  },
  'models.key.signin': { ko: '로그인하고 키 발급받기 →', en: 'Sign in and create a key →' },
  // A Google session names a person to this app; it is not a session on the node, and the node is what issues keys.
  'models.key.google': {
    ko: '{email} 계정(Google)으로 로그인되어 있습니다. API 키는 노드가 발급하고, 노드는 지갑 서명으로만 로그인을 받습니다 — 키를 받으려면 지갑을 연결하세요.',
    en: 'Signed in as {email} with Google. API keys are issued by the node, and the node only accepts a wallet signature — connect a wallet to create one.',
  },
  'models.key.connect': { ko: '지갑 연결하고 키 발급받기 →', en: 'Connect a wallet and create a key →' },
  'models.key.create': { ko: '키 발급', en: 'Create a key' },
  'models.key.creating': { ko: '발급 중…', en: 'Creating…' },
  'models.key.manage': { ko: '내 키 관리 →', en: 'Manage your keys →' },
  'models.key.held': {
    ko: '이 키는 이 탭에만 보관됩니다. 노드는 해시만 저장하므로 다시 보여줄 수 없습니다 — 지금 안전한 곳에 복사해 두세요.',
    en: 'This key is held in this tab only. The node stores a hash, so it cannot be shown again — copy it somewhere safe now.',
  },
  'models.key.forget': { ko: '이 탭에서 지우기', en: 'Forget it in this tab' },
  'models.key.failed': { ko: '키를 발급하지 못했습니다: {why}', en: 'The key could not be created: {why}' },
  'models.code.title': { ko: '코드로 가져가기', en: 'Take the code' },
  'models.code.lede': {
    ko: '위에서 방금 한 호출을, 내 프로그램에서 하는 형태로. 예치한 지분이 처리량 중 내 몫이 됩니다.',
    en: 'The call you just made, as your program would make it. What you deposit becomes your share of the throughput.',
  },
  'models.code.copy': { ko: '복사', en: 'Copy' },
  'models.code.copied': { ko: '복사됨', en: 'Copied' },
  'models.code.docs': { ko: '한도, 예치, 에러 코드 — 전체 안내', en: 'Limits, deposits and error codes — the full guide' },
};
