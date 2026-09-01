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
  // multi-knowledge (spec §5.3 — kept in chat.ts because the picker owns them)
  'chat.picker.multi_title': { ko: '넣을 지식 (최대 3개)', en: 'Knowledge to load (pick up to 3)' },
  'chat.picker.multi_help': { ko: '체크한 순서대로 넣습니다. 겹치면 나중에 체크한 쪽이 이깁니다.', en: 'They load in the order you tick them. If two overlap, the one ticked last wins.' },
  'chat.picker.overlap': { ko: '이 둘은 메모리 항목 {n}개가 겹칩니다.', en: 'These two overlap on {n} memory entries.' },
  'chat.picker.overlap_pair': { ko: '{a}와(과) {b}: 메모리 항목 {n}개가 겹칩니다 — 나중에 체크한 {winner}이(가) 이깁니다.', en: '{a} and {b} overlap on {n} memory entries — {winner}, ticked last, wins.' },
  'chat.picker.contaminated': { ko: '이 노드에는 {names}이(가) 항상 넣어져 있어 "넣기 전"에도 포함됩니다.', en: 'This node also has {names} loaded for everyone, so "Before loading" already includes it.' },
  'chat.picker.mine': { ko: '내 수업', en: 'Your lessons' },
  'chat.picker.max': { ko: '최대 3개까지입니다. 하나를 해제한 뒤 고르세요.', en: 'Up to 3 — untick one first.' },
  'chat.picker.order': { ko: '{n}번째로 넣음', en: 'Loads {n}.' },
  'chat.picker.order_help': { ko: '체크한 순서입니다. 같은 항목이 겹치면 번호가 큰 쪽이 이깁니다.', en: 'Tick order. Where entries overlap, the higher number wins.' },
  'chat.picker.always_loaded': { ko: '항상 넣어져 있음', en: 'Always loaded' },
  'chat.picker.pick_none': { ko: '모두 해제', en: 'Clear selection' },
  'chat.picker.count': { ko: '{n}/3 선택', en: '{n}/3 selected' },
  'chat.head.multi': { ko: '지식 {n}개 함께 넣음', en: '{n} knowledges loaded together' },
  'chat.head.multi_help': { ko: '왼쪽 순서대로 넣습니다. 겹치는 항목은 마지막 지식이 이깁니다.', en: 'Loaded in the order on the left; the last one wins on overlapping entries.' },
  'chat.bubble.patched_multi': { ko: '지식 {n}개 넣은 후', en: 'After loading {n}' },
  'chat.hit.per_patch': { ko: '{id}의 검증 문제', en: 'benchmark item of {id}' },
  'chat.samples.from': { ko: '{id}의 예시', en: 'from {id}' },

  // runtime / lock
  'chat.runtime.off': { ko: '지금은 모델 서버가 꺼져 있어 테스트할 수 없습니다.', en: 'The model server is off right now, so testing is unavailable.' },
  'chat.runtime.off_detail': { ko: '노드 운영자가 모델 서버를 켜면 다시 사용할 수 있습니다.', en: 'It comes back once the node operator starts the model server.' },
  // "try again in a moment" is deliberately gone: the request is queued and will be answered, so retry language
  // made a wait read as a rejection (D3). A queued request gets its own live line in the transcript (chat.queue.*).
  'chat.lock.busy': { ko: '지금 다른 사람이 공유 모델에서 테스트 중입니다.', en: 'Someone else is testing on the shared model right now.' },
  'chat.lock.holder': { ko: '다른 테스트 진행 중 ({label}, 노드 프로세스 {pid}) — {since}', en: 'Another test in progress ({label}, node process {pid}) — {since}' },
  'chat.lock.mine': { ko: '지금은 이 테스트가 공유 모델을 쓰고 있습니다 — {since}', en: 'Your test has the shared model — {since}' },
  'chat.lock.stale': { ko: '이전 테스트가 공유 모델을 사용 중으로 남겨 두었습니다. 다음 테스트가 자동으로 정리합니다.', en: 'A previous test left the shared model marked as busy; the next test clears it automatically.' },
  'chat.time.s': { ko: '{n}초 전 시작', en: 'started {n}s ago' },
  'chat.time.m': { ko: '{n}분 전 시작', en: 'started {n}m ago' },
  'chat.time.h': { ko: '{n}시간 전 시작', en: 'started {n}h ago' },
  'chat.price_note': { ko: '{note}', en: '{note}' },
  'chat.lock.help': { ko: '모델은 한 번에 하나의 지식만 넣었다 뺄 수 있어 테스트가 순서대로 실행됩니다.', en: 'The model loads and unloads one knowledge at a time, so tests run one after another.' },

  // queue (D3) — what the transcript says while a request waits behind the shared model
  'chat.queue.waiting': { ko: '다른 테스트 뒤에서 순서를 기다리는 중입니다 — 질문은 사라지지 않았습니다.', en: 'Queued behind another test — your question has not been lost.' },
  'chat.queue.holder': { ko: '다른 사람이 공유 모델을 쓰고 있습니다({label}, {since}).', en: 'Someone else has the shared model ({label}, {since}).' },
  'chat.queue.mine': { ko: '지금은 이 테스트가 공유 모델을 쓰고 있습니다 — 곧 답이 나옵니다.', en: 'Your test has the shared model now — the answer is on its way.' },
  'chat.queue.position': { ko: '대기 순서 {n}번입니다.', en: 'You are number {n} in line.' },
  'chat.queue.elapsed': { ko: '{n}초째 대기', en: 'waiting {n}s' },
  'chat.queue.long': { ko: '{n}분째 대기 중입니다 — 공유 모델이 평소보다 오래 잡혀 있습니다. 계속 기다리거나 그만둘 수 있습니다.', en: 'Still queued after {n} minutes — the shared model is busy for longer than usual. You can keep waiting or stop.' },
  'chat.queue.stop_waiting': { ko: '기다리지 않기', en: 'Stop waiting' },
  'chat.queue.cancelled': { ko: '기다리기를 그만두었습니다. 노드가 아직 테스트를 시작하지 않아 무료 체험 횟수는 차감되지 않았습니다.', en: 'You stopped waiting. The node had not started this test yet, so no free try was used.' },
  'chat.queue.cancelled_late': { ko: '기다리기를 그만두었지만 공유 모델에서 이미 테스트가 시작되어 무료 체험 1회로 계산됩니다.', en: 'You stopped waiting, but the test had already started on the shared model, so it still counts as one free try.' },

  // quota
  'chat.quota.left': { ko: '이 시간 무료 체험 {n}회 남음', en: '{n} free tries left this hour' },
  'chat.quota.left_of': { ko: '무료 체험 {n}/{limit} 남음 (이 시간)', en: 'Free trial {n}/{limit} left this hour' },
  'chat.quota.none': { ko: '이 시간 무료 체험을 모두 사용했습니다. 한 시간 뒤 다시 시도하거나 지식을 구매하세요.', en: 'You used all free tries for this hour. Try again in an hour or buy the knowledge.' },
  'chat.quota.buy': { ko: '이 지식 구매하기', en: 'Buy this knowledge' },
  'chat.quota.resets_at': { ko: '무료 체험은 {time}에 다시 채워집니다', en: 'Free tries reset at {time}' },
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
  // D2: the trained prompt ends with a space, and that space is part of what was trained. The chip shows a ␣
  // marker and sends the text exactly as trained (its accessible name stays the plain prompt).
  'chat.samples.trailing_space': { ko: '끝의 공백까지가 학습된 프롬프트입니다 — 누르면 공백을 포함해 그대로 입력되고 그대로 전송됩니다.', en: 'The trailing space is part of the trained prompt — clicking inserts it, and it is sent, exactly as trained.' },
  'chat.samples.verbatim': { ko: '예시는 학습된 그대로(끝 공백 포함) 전송됩니다.', en: 'Samples are sent exactly as trained, trailing space included.' },
  'chat.samples.format_note': { ko: '이 지식은 완성형(예: "종목코드 회사명 ")으로 학습되고 검증되었습니다. 라이브 테스트는 채팅 형식으로 물어보기 때문에 검증 점수와 답이 다를 수 있습니다.', en: 'This knowledge was trained and verified in the completion form (e.g. "종목코드 <company> "). The live test asks through the chat format, so the answer can differ from its verified score.' },
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

  // follow-up questions: each column replays its own earlier answers (never the other's)
  'chat.history.split': { ko: '이어지는 질문에서 각 열은 자기가 한 답만 다시 보게 됩니다 — "넣기 전" 모델에는 지식이 낸 답을 알려주지 않습니다.', en: 'On follow-up questions each column replays only its own earlier answers — the "Before loading" model is never shown what the knowledge answered.' },

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
  // D1 — what the visitor is told when the guard cut a runaway answer
  'chat.trunc.repetition': { ko: '모델이 같은 말을 반복하기 시작해서 답을 여기서 잘랐습니다. 보통은 이 지식이 다루지 않는 질문일 때 이렇게 됩니다.', en: 'The model started repeating itself, so the answer is cut off here — that usually means the question is outside what this knowledge covers.' },
  'chat.trunc.length': { ko: '길이 제한에 걸려 답이 끝나기 전에 멈췄습니다.', en: 'The answer stopped at the length limit before it was finished.' },
  'chat.trunc.empty': { ko: '모델이 생각하는 데 길이를 다 써서 답이 비어 있습니다. 생각 과정을 끄고 다시 물어보세요.', en: 'The model spent its whole length limit thinking, so the answer came back empty. Turn thinking off and ask again.' },
  'chat.trunc.show_raw': { ko: '원본 답변 보기 ({raw}자 전체)', en: 'Show the raw answer (all {raw} characters)' },
  'chat.trunc.hide_raw': { ko: '원본 답변 숨기기', en: 'Hide the raw answer' },
  'chat.trunc.shown': { ko: '{raw}자 중 {shown}자를 보여 줍니다', en: 'showing {shown} of {raw} characters' },
  'chat.bubble.reasoning': { ko: '생각 과정 보기', en: 'Show thinking' },
  'chat.hit.yes': { ko: '정답', en: 'Correct' },
  'chat.hit.no': { ko: '오답', en: 'Wrong' },
  'chat.hit.help': { ko: '이 질문은 이 지식의 검증 문제 중 하나라 기대 답과 자동으로 비교했습니다. 기대 답: {expect}', en: 'This question is one of the knowledge’s benchmark items, so the answer was checked automatically. Expected: {expect}' },
  'chat.hit.expected': { ko: '기대 답:', en: 'Expected:' },
  'chat.hit.unknown': { ko: '자유 질문 — 자동 채점 없음', en: 'Free question — not auto-scored' },
  'chat.turn.retry': { ko: '다시 시도', en: 'Retry' },

  // errors (plain Korean; server messages are mapped in ChatPage)
  'chat.err.no_body': { ko: '이 노드에 지식 본문이 없습니다. 판매 노드에서 테스트하거나 먼저 구매하세요.', en: 'This node does not have the knowledge body. Test it on the seller’s node or buy it first.' },
  'chat.err.quota': { ko: '이 시간 무료 체험 횟수를 모두 사용했습니다. 한 시간 뒤 다시 시도하거나 지식을 구매해 내 노드에서 제한 없이 쓰세요.', en: 'You used all free tries for this hour. Try again in an hour, or buy the knowledge and use it without limits on your own node.' },
  'chat.err.busy': { ko: '공유 모델이 오래 잡혀 있어 기다리다 포기했습니다. 잠시 후 다시 시도하세요.', en: 'The shared model stayed busy for too long, so this request gave up waiting. Try again in a moment.' },
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
  'chat.dev.body': { ko: '이 화면은 노드의 POST /api/chat을 호출합니다(patch_id 또는 patch_ids[1..3]). 요청마다 공유 모델 잠금 아래에서 [지식 빼기 → 넣기 전 답] → [체크한 순서대로 넣기 → 넣은 후 답] → 역순으로 원상 복구 순으로 실행되며, 넣은 후 답변은 지식마다 하나씩 사용 기록(hit)으로 계량됩니다. 운영자가 항상 넣어 둔 지식은 GET /api/chat/patches의 applied[]에 나옵니다.', en: 'This page calls the node’s POST /api/chat (patch_id or patch_ids[1..3]). Each request runs under the shared runtime lock: [unload → base answer] → [load in tick order → patched answer] → restore in reverse, and every patched answer is metered as one usage hit per knowledge. Knowledge the operator keeps loaded is listed in GET /api/chat/patches applied[].' },
};
