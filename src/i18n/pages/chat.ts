import type { Dict } from '../index';

/** ChatMode (live test) page — /chat and /chat/:patchId. Plain language first; technical names live in tooltips. */
export const chat: Dict = {
  'chat.title': { ko: '라이브 테스트', en: 'Live test' },
  'chat.subtitle': { ko: '같은 질문을 지식을 넣기 전과 넣은 후의 모델에 물어보고 답이 어떻게 달라지는지 직접 확인하세요. 재시작 없이 몇 초 만에 넣었다 뺍니다.', en: 'Ask the same question before and after loading the knowledge and watch the answer change. It loads and unloads in seconds, no restart.' },
  'chat.model': { ko: '테스트 모델', en: 'Test model' },
  'chat.model_unknown': { ko: '모델 정보 없음', en: 'Model unknown' },

  // picker
  'chat.picker.title': { ko: '테스트할 지식', en: 'Knowledge to test' },
  'chat.picker.hint': { ko: '이 노드에 본문이 있는 지식만 테스트할 수 있습니다.', en: 'Only knowledge whose body is on this node can be tested.' },
  'chat.picker.empty': { ko: '이 노드에서 테스트할 수 있는 지식이 아직 없습니다.', en: 'No knowledge on this node can be tested yet.' },
  'chat.picker.accuracy': { ko: '정답률 {pct}%', en: '{pct}% accuracy' },
  'chat.picker.accuracy_raw': { ko: '정답률 {score}', en: 'accuracy {score}' },
  'chat.picker.not_scored': { ko: '아직 채점 전', en: 'Not scored yet' },
  'chat.picker.not_scored_help': { ko: '검증 노드가 실제 모델에 넣어 채점하기 전입니다. 라이브 테스트로 직접 확인해 보세요.', en: 'Verifier nodes have not scored it on the real model yet. Try it live yourself.' },
  'chat.picker.selected': { ko: '선택됨', en: 'Selected' },
  'chat.picker.route_missing': { ko: '주소에 적힌 지식({id})은 이 노드에서 테스트할 수 없어 목록의 첫 번째 지식을 골랐습니다.', en: 'The knowledge in the address ({id}) cannot be tested on this node, so the first one in the list was chosen.' },

  // runtime / lock
  'chat.runtime.off': { ko: '지금은 모델 서버가 꺼져 있어 테스트할 수 없습니다.', en: 'The model server is off right now, so testing is unavailable.' },
  'chat.runtime.off_detail': { ko: '노드 운영자가 모델 서버를 켜면 다시 사용할 수 있습니다.', en: 'It comes back once the node operator starts the model server.' },
  'chat.lock.busy': { ko: '다른 테스트가 진행 중 — 잠시 후 다시 시도하세요.', en: 'Another test is running — try again in a moment.' },
  'chat.lock.holder': { ko: '다른 테스트 진행 중 (노드 프로세스 {pid}) — {since}', en: 'Another test in progress (node process {pid}) — {since}' },
  'chat.time.s': { ko: '{n}초 전 시작', en: 'started {n}s ago' },
  'chat.time.m': { ko: '{n}분 전 시작', en: 'started {n}m ago' },
  'chat.time.h': { ko: '{n}시간 전 시작', en: 'started {n}h ago' },
  'chat.price_note': { ko: '{note}', en: '{note}' },
  'chat.lock.help': { ko: '모델은 한 번에 하나의 지식만 넣었다 뺄 수 있어 테스트가 순서대로 실행됩니다.', en: 'The model loads and unloads one knowledge at a time, so tests run one after another.' },

  // quota
  'chat.quota.left': { ko: '이 시간 무료 체험 {n}회 남음', en: '{n} free tries left this hour' },
  'chat.quota.left_of': { ko: '무료 체험 {n}/{limit} 남음 (이 시간)', en: 'Free trial {n}/{limit} left this hour' },
  'chat.quota.none': { ko: '이 시간 무료 체험을 모두 사용했습니다. 한 시간 뒤 다시 시도하거나 지식을 구매하세요.', en: 'You used all free tries for this hour. Try again in an hour or buy the knowledge.' },
  'chat.quota.visitor': { ko: '무료 체험은 시간당 횟수가 제한됩니다. 로그인 없이 바로 써 볼 수 있습니다.', en: 'Free tries are limited per hour. No sign-in needed.' },
  'chat.quota.operator': { ko: '이 노드의 운영자로 로그인되어 있어 횟수 제한 없이 테스트할 수 있습니다.', en: 'You are signed in as this node’s operator — unlimited tests.' },

  // controls
  'chat.mode.label': { ko: '보기 방식', en: 'View' },
  'chat.mode.compare': { ko: '비교', en: 'Compare' },
  'chat.mode.patched': { ko: '넣은 후만', en: 'After only' },
  'chat.mode.base': { ko: '넣기 전만', en: 'Before only' },
  'chat.mode.compare_help': { ko: '지식을 넣기 전과 후의 답을 나란히 봅니다. 넣었다 빼는 과정이 포함되어 조금 더 걸립니다.', en: 'See answers before and after side by side. Includes loading and unloading, so it takes a bit longer.' },
  'chat.mode.patched_help': { ko: '지식을 넣은 모델의 답만 봅니다.', en: 'Only the answer with the knowledge loaded.' },
  'chat.mode.base_help': { ko: '지식을 넣지 않은 원래 모델의 답만 봅니다.', en: 'Only the original model’s answer.' },
  'chat.thinking.label': { ko: '생각 과정 켜기', en: 'Enable thinking' },
  'chat.thinking.help': { ko: '기본은 꺼짐입니다. 켜면 모델이 답하기 전에 길게 생각해서 답이 느려집니다. 짧은 사실 질문에는 꺼 두는 편이 좋습니다.', en: 'Off by default. When on, the model reasons at length before answering, so replies are slower. Keep it off for short factual questions.' },
  'chat.thinking.slow': { ko: '생각 과정이 켜져 있어 답이 느립니다', en: 'Thinking is on — replies are slower' },

  // composer
  'chat.samples.title': { ko: '이 지식이 답할 수 있는 질문 예시', en: 'Sample questions this knowledge answers' },
  'chat.samples.help': { ko: '누르면 입력창에 들어갑니다. 보내기 전에 고쳐도 됩니다.', en: 'Click to put it in the box. You can edit before sending.' },
  'chat.samples.expect': { ko: '기대 답: {expect}', en: 'Expected: {expect}' },
  'chat.samples.more': { ko: '예시 {n}개 더 보기', en: 'Show {n} more' },
  'chat.samples.less': { ko: '접기', en: 'Show less' },
  'chat.input.placeholder': { ko: '질문을 입력하고 Enter를 누르세요 (줄바꿈은 Shift+Enter)', en: 'Type a question and press Enter (Shift+Enter for a new line)' },
  'chat.input.placeholder_off': { ko: '지금은 테스트할 수 없습니다', en: 'Testing is unavailable right now' },
  'chat.input.send': { ko: '보내기', en: 'Send' },
  'chat.input.sending': { ko: '답변 기다리는 중…', en: 'Waiting for the answer…' },
  'chat.input.clear': { ko: '대화 지우기', en: 'Clear conversation' },
  'chat.input.pick_first': { ko: '먼저 왼쪽에서 테스트할 지식을 고르세요.', en: 'Pick the knowledge to test on the left first.' },
  'chat.input.cancel': { ko: '취소', en: 'Cancel' },
  'chat.input.in_flight': { ko: '답을 기다리는 중입니다. 오래 걸리면 취소할 수 있습니다.', en: 'Waiting for the answer — you can cancel if it takes too long.' },

  // transcript
  'chat.empty.title': { ko: '아직 질문이 없습니다', en: 'No questions yet' },
  'chat.empty.body': { ko: '아래 예시 질문을 누르거나 직접 질문을 입력해 보세요. 답은 "지식 넣기 전"과 "지식 넣은 후" 두 개가 나란히 나옵니다.', en: 'Click a sample question below or type your own. You get two answers side by side: before and after loading the knowledge.' },
  'chat.turn.you': { ko: '나', en: 'You' },
  'chat.bubble.base': { ko: '지식 넣기 전', en: 'Before loading' },
  'chat.bubble.patched': { ko: '지식 넣은 후', en: 'After loading' },
  'chat.bubble.base_help': { ko: '지식을 넣지 않은 원래 모델의 답입니다.', en: 'Answer from the original model, without the knowledge.' },
  'chat.bubble.patched_help': { ko: '이 지식을 모델에 넣은 뒤의 답입니다. 테스트가 끝나면 원래 상태로 되돌립니다.', en: 'Answer after the knowledge was loaded into the model. It is restored afterwards.' },
  'chat.bubble.latency': { ko: '응답 {ms}', en: 'reply {ms}' },
  'chat.bubble.applied': { ko: '넣는 데 {ms}', en: 'loaded in {ms}' },
  'chat.bubble.already_applied': { ko: '이미 넣어져 있던 지식', en: 'was already loaded' },
  'chat.bubble.thinking_pending': { ko: '답변 생성 중…', en: 'Generating…' },
  'chat.bubble.compare_pending': { ko: '지식을 넣었다 빼는 과정이 포함되어 수십 초 걸릴 수 있습니다.', en: 'Includes loading and unloading — this can take tens of seconds.' },
  'chat.bubble.empty_answer': { ko: '(빈 답변)', en: '(empty answer)' },
  'chat.bubble.reasoning': { ko: '생각 과정 보기', en: 'Show thinking' },
  'chat.hit.yes': { ko: '정답', en: 'Correct' },
  'chat.hit.no': { ko: '오답', en: 'Wrong' },
  'chat.hit.help': { ko: '이 질문은 이 지식의 검증 문제 중 하나라 기대 답과 자동으로 비교했습니다. 기대 답: {expect}', en: 'This question is one of the knowledge’s benchmark items, so the answer was checked automatically. Expected: {expect}' },
  'chat.hit.unknown': { ko: '자유 질문 — 자동 채점 없음', en: 'Free question — not auto-scored' },
  'chat.turn.retry': { ko: '다시 시도', en: 'Retry' },

  // errors (plain Korean; server messages are mapped in ChatPage)
  'chat.err.no_body': { ko: '이 노드에 지식 본문이 없습니다. 판매 노드에서 테스트하거나 먼저 구매하세요.', en: 'This node does not have the knowledge body. Test it on the seller’s node or buy it first.' },
  'chat.err.quota': { ko: '이 시간 무료 체험 횟수를 모두 사용했습니다. 한 시간 뒤 다시 시도하거나 지식을 구매해 내 노드에서 제한 없이 쓰세요.', en: 'You used all free tries for this hour. Try again in an hour, or buy the knowledge and use it without limits on your own node.' },
  'chat.err.busy': { ko: '다른 테스트가 진행 중이라 이번 요청을 처리하지 못했습니다. 잠시 후 다시 시도하세요.', en: 'Another test was running so this request could not be handled. Try again in a moment.' },
  'chat.err.runtime': { ko: '모델 서버가 꺼져 있거나 응답하지 않습니다. 잠시 후 다시 시도하세요.', en: 'The model server is off or not responding. Try again in a moment.' },
  'chat.err.model': { ko: '이 지식은 이 노드가 서비스하는 모델과 다른 모델용이라 테스트할 수 없습니다.', en: 'This knowledge targets a different model than the one this node serves.' },
  'chat.err.not_found': { ko: '해당 지식을 찾을 수 없습니다. 목록에서 다시 골라 주세요.', en: 'That knowledge could not be found. Pick one from the list again.' },
  'chat.err.network': { ko: '노드에 연결할 수 없습니다. 네트워크 상태를 확인하고 다시 시도하세요.', en: 'Could not reach the node. Check your connection and try again.' },
  'chat.err.timeout': { ko: '답을 기다리다 시간이 초과되었습니다. 생각 과정을 끄거나 잠시 후 다시 시도하세요.', en: 'Timed out waiting for the answer. Turn thinking off or try again shortly.' },
  'chat.err.generic': { ko: '테스트 중 문제가 생겼습니다: {message}', en: 'Something went wrong during the test: {message}' },
  'chat.err.cancelled': { ko: '요청을 취소했습니다.', en: 'Request cancelled.' },
  'chat.err.too_long': { ko: '요청이 너무 길거나 형식이 맞지 않습니다. 대화를 지우고 다시 시도하세요.', en: 'The request was too long or malformed. Clear the conversation and try again.' },

  // developer note
  'chat.dev.title': { ko: '노드 운영자·개발자', en: 'Node operators & developers' },
  'chat.dev.body': { ko: '이 화면은 노드의 POST /api/chat을 호출합니다. 요청마다 공유 모델 잠금 아래에서 [지식 빼기 → 넣기 전 답] → [지식 넣기 → 넣은 후 답] → 원상 복구 순으로 실행되며, 넣은 후 답변은 사용 기록(hit)으로 계량됩니다.', en: 'This page calls the node’s POST /api/chat. Each request runs under the shared runtime lock: [unload → base answer] → [load → patched answer] → restore, and every patched answer is metered as a usage hit.' },
};
