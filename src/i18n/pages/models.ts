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

  'models.code.title': { ko: '코드로 가져가기', en: 'Take the code' },
  'models.code.lede': {
    ko: '위에서 방금 한 호출을, 내 프로그램에서 하는 형태로. 예치한 지분이 처리량 중 내 몫이 됩니다.',
    en: 'The call you just made, as your program would make it. What you deposit becomes your share of the throughput.',
  },
  'models.code.copy': { ko: '복사', en: 'Copy' },
  'models.code.copied': { ko: '복사됨', en: 'Copied' },
  'models.code.docs': { ko: '한도, 예치, 에러 코드 — 전체 안내', en: 'Limits, deposits and error codes — the full guide' },
};
