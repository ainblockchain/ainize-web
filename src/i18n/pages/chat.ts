import type { Dict } from '../index';

/** ChatMode (live test) page — /chat and /chat/:patchId. Plain language first; technical names live in tooltips. */
export const chat: Dict = {
  'chat.title': { ko: '라이브 테스트', en: 'Live test' },
  'chat.subtitle': { ko: '같은 질문을 지식을 넣기 전과 넣은 후의 모델에 물어보고 답이 어떻게 달라지는지 직접 확인하세요. 재시작 없이 몇 초 만에 넣었다 뺍니다.', en: 'Ask the same question before and after loading the knowledge and watch the answer change. It loads and unloads in seconds, no restart.' },
  'chat.model': { ko: '테스트 모델', en: 'Test model' },
  'chat.model_unknown': { ko: '모델 정보 없음', en: 'Model unknown' },
  // Finding 35 — what a visitor is told about the chip. The serving endpoint behind it is the operator's business.
  'chat.model_help': { ko: '이 노드가 서비스하는 모델입니다. 라이브 테스트는 넣기 전과 넣은 후 모두 이 모델에서 실행됩니다.', en: 'The model this node serves — every live test, before and after loading, runs on it.' },

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
  // Finding 62 — ONE alert for the whole selection. Each line names the knowledge by the number on its card
  // (#1, #2, #3) instead of repeating two 50-character titles and the winner's title again.
  'chat.picker.overlap_head': { ko: '아래 지식들이 같은 기억 항목을 공유합니다 (번호는 카드에 적힌 넣는 순서):', en: 'These share memory entries — the numbers are the load order on the cards:' },
  'chat.picker.overlap_line': { ko: '{a}과 {b}: 기억 항목 {n}개를 공유합니다 — 겹치는 자리는 나중에 넣는 {winner}이 가져갑니다.', en: '{a} and {b}: {n} shared memory entries — {winner} loads later and wins where they collide.' },
  // Finding 225 — an overlap with knowledge the OPERATOR keeps loaded was never shown, although the visitor
  // cannot untick that one: it is on the model before anything they choose, so anything they tick wins over it.
  'chat.picker.overlap_line_pinned': { ko: '{a}은 이 노드가 항상 넣어 두는 지식과 기억 항목 {n}개를 공유합니다("{name}") — 나중에 넣는 {a}이 가져갑니다.', en: '{a} shares {n} memory entries with “{name}”, which this node keeps loaded — {a} loads after it and wins.' },
  'chat.picker.contaminated': { ko: '이 노드가 항상 넣어 두는 지식이 있어 "넣기 전" 답에도 포함됩니다: {names}', en: 'This node also has {names} loaded for everyone, so "Before loading" already includes it.' },
  // Finding 225 — the same card used to read "Always loaded · Loads 1.", two statements that contradict each other.
  'chat.picker.pinned_ticked': { ko: '이미 모델에 들어 있습니다 — "넣기 전" 답을 받을 때 잠시 빼냈다가 다시 넣습니다.', en: 'Already in the model — unloaded for the "Before loading" answer, then put back.' },
  'chat.picker.count_pinned': { ko: '이 노드에 항상 넣어 둔 지식 {n}개 더', en: '{n} more always loaded here' },
  'chat.picker.count_pinned_one': { ko: '이 노드에 항상 넣어 둔 지식 1개 더', en: '1 more always loaded here' },
  // Finding 224 — the load order is a control now, not something you can only change by unticking everything.
  'chat.picker.move_up': { ko: '먼저 넣기 (Alt+↑)', en: 'Load this earlier (Alt+↑)' },
  'chat.picker.move_down': { ko: '나중에 넣기 (Alt+↓)', en: 'Load this later (Alt+↓)' },
  'chat.picker.loaded_section': { ko: '넣는 순서', en: 'Loaded, in this order' },
  'chat.picker.loaded_section_one': { ko: '넣을 지식', en: 'Loaded' },
  'chat.picker.rest_section': { ko: '고를 수 있는 다른 지식', en: 'Other knowledge you can pick' },
  // Finding 218 — a node holding 136 testable knowledges listed all 136 and offered no way to find one.
  'chat.picker.filter': { ko: '지식 {n}개에서 찾기', en: 'Search {n} knowledges' },
  'chat.picker.filter_count': { ko: '{total}개 중 {n}개 표시 중', en: 'showing {n} of {total}' },
  'chat.picker.filter_none': { ko: '"{q}"와(과) 맞는 지식이 없습니다.', en: 'No knowledge matches “{q}”.' },
  // Item 211 — a body on the shared model that this node never loaded (another node's verification, a crashed test).
  'chat.picker.dirty': { ko: '무언가가 이 모델에 남겨 둔 지식이 있습니다 — 이 노드가 넣은 것이 아닙니다: {names}', en: 'Something left {names} on this model — this node did not load it.' },
  'chat.picker.dirty_detail': { ko: '테스트할 때 먼저 빼내고 "넣기 전" 답을 받으며, 테스트가 끝나도 다시 넣지 않습니다.', en: 'A live test unloads it first so the "before" answer is the plain model, and does not put it back afterwards.' },
  // Item 297 — knowledge this node's model could run but does not hold, or holds only because it verified it.
  'chat.picker.elsewhere': { ko: '이 노드에 없는 지식', en: 'Not on this node' },
  'chat.picker.elsewhere_help': { ko: '이 모델에서 돌아갈 수 있지만 이 노드가 아직 가지고 있지 않은 지식입니다. 이 노드가 사면 여기서 바로 테스트하거나 그 위에 가르칠 수 있습니다.', en: 'Knowledge this node’s model could run but this node does not have. Once this node buys it you can test it here — or teach on top of it.' },
  'chat.picker.why.not_held': { ko: '이 노드에 파일이 없습니다 — 판매자에게서 사야 테스트할 수 있습니다.', en: 'The file is not on this node — it has to be bought from the seller before it can be tested.' },
  'chat.picker.why.verify_only': { ko: '이 노드가 검증하느라 파일은 받아 뒀지만, 검증은 사용 권한이 아닙니다 — 쓰려면 구매해야 합니다.', en: 'This node fetched the file to verify it, and verifying is not a licence to use it — it has to be bought.' },
  'chat.picker.why.not_licensed': { ko: '파일은 있지만 이 노드가 구매하지 않았습니다 — 구매해야 넣을 수 있습니다.', en: 'The file is here but this node never bought it — it has to be bought before it can be loaded.' },
  'chat.picker.buy': { ko: '구매 ({price})', en: 'Buy ({price})' },
  'chat.picker.buying': { ko: '구매하는 중…', en: 'Buying…' },
  'chat.picker.ask': { ko: '이 지식을 받아 달라고 요청', en: 'Ask this node to get it' },
  'chat.picker.asked_done': { ko: '요청했습니다 — 운영자 기록에 남았습니다', en: 'Asked — it is in the operator’s log' },
  'chat.picker.asked': { ko: '{n}명이 이 지식을 요청했습니다.', en: '{n} visitors have asked for this.' },
  // finding 88 — "1 visitor(s) have asked" was the placeholder plural reaching a real page
  'chat.picker.asked_one': { ko: '한 명이 이 지식을 요청했습니다.', en: '1 visitor has asked for this.' },
  'chat.picker.mine': { ko: '내 수업', en: 'Your lessons' },
  'chat.picker.max': { ko: '최대 3개까지입니다. 하나를 해제한 뒤 고르세요.', en: 'Up to 3 — untick one first.' },
  'chat.picker.order': { ko: '{n}번째로 넣음', en: 'Loads {n}.' },
  'chat.picker.order_help': { ko: '체크한 순서입니다. 같은 항목이 겹치면 번호가 큰 쪽이 이깁니다.', en: 'Tick order. Where entries overlap, the higher number wins.' },
  'chat.picker.always_loaded': { ko: '항상 넣어져 있음', en: 'Always loaded' },
  'chat.picker.pick_none': { ko: '모두 해제', en: 'Clear selection' },
  'chat.picker.count': { ko: '{n}/3 선택', en: '{n}/3 selected' },
  'chat.head.multi': { ko: '지식 {n}개 함께 넣음', en: '{n} knowledges loaded together' },
  'chat.head.multi_help': { ko: '왼쪽 순서대로 넣습니다. 겹치는 항목은 마지막 지식이 이깁니다.', en: 'Loaded in the order on the left; the last one wins on overlapping entries.' },
  // Finding 63 — knowledge that shares memory entries cannot have its fact counts added up.
  'chat.head.facts_each': { ko: '각각 최대 사실 {n}건 (겹치는 부분이 있어 합계로 셀 수 없습니다)', en: 'up to {n} facts each (they overlap, so the counts do not add up)' },
  // Finding 218 — the set as something you can send to someone.
  'chat.head.copy': { ko: '이 조합 링크 복사', en: 'Copy link to this set' },
  'chat.head.copied': { ko: '복사했습니다', en: 'Link copied' },
  // Finding 228 — what owning the whole stack costs, on the node you run yourself.
  'chat.head.own': { ko: '이 {n}개를 모두 소유하려면: {price}', en: 'To own all {n}: {price}' },
  'chat.head.own_help': { ko: '각 지식의 판매 가격을 더한 값입니다. 구매는 지식마다 따로 이루어지며, 내 노드에서 구매하면 횟수 제한 없이 쓸 수 있습니다.', en: 'The listed prices added up. Each is bought separately, on your own node, and then runs without a free-try limit.' },
  'chat.head.replaced': { ko: '대체 버전 {id}', en: 'replaced by {id}' },
  'chat.head.replaced_help': { ko: '더 새로운 버전이 이 지식을 대체했습니다. 새 버전이 같은 내용을 담고 있을 수 있으니 구매 전에 확인하세요.', en: 'A newer version has replaced this one — it may already cover the same facts, so check it before buying this.' },
  'chat.bubble.patched_multi': { ko: '지식 {n}개 넣은 후', en: 'After loading {n}' },
  'chat.hit.per_patch': { ko: '{id}의 검증 문제', en: 'benchmark item of {id}' },
  'chat.samples.from': { ko: '{id}의 예시', en: 'from {id}' },

  // runtime / lock
  'chat.runtime.off': { ko: '지금은 모델 서버가 꺼져 있어 테스트할 수 없습니다.', en: 'The model server is off right now, so testing is unavailable.' },
  'chat.runtime.off_detail': { ko: '노드 운영자가 모델 서버를 켜면 다시 사용할 수 있습니다.', en: 'It comes back once the node operator starts the model server.' },
  // "try again in a moment" is deliberately gone: the request is queued and will be answered, so retry language
  // made a wait read as a rejection (D3). A queued request gets its own live line in the transcript (chat.queue.*).
  'chat.lock.busy': { ko: '지금 공유 모델을 다른 작업이 쓰고 있습니다.', en: 'Something else has the shared model right now.' },
  // Finding 65 — the visitor is told WHAT is running, never the internal lock key or the node's process id; and a
  // lock on the lesson this page is showing is their own lesson being checked, not a stranger's test.
  'chat.lock.busy_mine_lesson': { ko: '내 수업을 공유 모델에서 확인하는 중입니다.', en: 'Your lesson is being checked on the shared model.' },
  'chat.lock.kind.chat': { ko: '다른 사람의 라이브 테스트 — {since}', en: 'Someone else’s live test — {since}' },
  'chat.lock.kind.teach': { ko: '수업 하나를 학습·확인하는 중 — {since}', en: 'A lesson being trained and checked — {since}' },
  'chat.lock.kind.teach_mine': { ko: '내 수업을 확인하는 중 — {since}', en: 'Your lesson being checked — {since}' },
  'chat.lock.kind.verify': { ko: '지식 하나를 검증하는 중 — {since}', en: 'A knowledge being verified — {since}' },
  'chat.lock.kind.apply': { ko: '운영자가 지식을 넣거나 빼는 중 — {since}', en: 'The operator is loading or unloading knowledge — {since}' },
  'chat.lock.kind.other': { ko: '이 모델에서 다른 작업이 실행 중 — {since}', en: 'Another job on this model — {since}' },
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
  // Finding 57 — the same sentence used to render in the page alert, the error bubble, the placeholder AND the
  // footer. The short line is what the placeholder and the transcript say; the offer below is made once.
  'chat.quota.none_short': { ko: '이 시간 무료 체험을 모두 썼습니다', en: 'No free tries left this hour' },
  'chat.quota.spent': { ko: '이 시간 무료 체험을 모두 썼습니다.', en: 'You have used every free try for this hour.' },
  'chat.quota.spent_of': { ko: '이 시간 무료 체험 {limit}회를 모두 썼습니다.', en: 'You have used all {limit} free tries for this hour.' },
  'chat.quota.buy_price': { ko: '{name} 구매 · {price}', en: 'Buy {name} · {price}' },
  'chat.quota.buy_free': { ko: '{name} 받기 (무료)', en: 'Get {name} (free)' },
  'chat.quota.resets_hour': { ko: '무료 체험은 한 시간 뒤 다시 채워집니다', en: 'Free tries come back within the hour' },
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
  // Finding 87 — the chips are Korean and their answers are six-character codes; an English-reading first-timer
  // had no way to know what the comparison they are about to run even asks. Both halves come from the anchor.
  'chat.samples.gloss': { ko: '{name}의 검증 문제입니다. 답은 "{expect}"처럼 정확히 일치해야 하는 짧은 값입니다.', en: 'These are the benchmark questions {name} publishes. Each answer is one short exact value, like “{expect}”.' },
  'chat.samples.gloss_stack': { ko: '넣은 지식 {n}개가 공개한 검증 문제입니다. 답은 "{expect}"처럼 정확히 일치해야 하는 짧은 값이고, 각 질문 아래에 어느 지식의 문제인지 적혀 있습니다.', en: 'These are the benchmark questions published by the {n} knowledges you loaded. Each answer is one short exact value, like “{expect}”, and every chip says which knowledge it came from.' },
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
  // Finding 66 — one misclick beside Send used to destroy a transcript bought with a capped twenty tries an hour.
  'chat.input.clear_confirm': { ko: '지울까요? 한 번 더 누르세요', en: 'Clear — are you sure?' },
  // Finding 61 — the node refuses a message longer than 4,000 characters, and the box used to say nothing.
  'chat.input.limit': { ko: '{n} / {max}자', en: '{n} / {max}' },
  'chat.input.limit_hit': { ko: '{max}자까지', en: '{max} character limit' },
  'chat.input.limit_help': { ko: '한 질문은 {max}자까지 보낼 수 있습니다. 더 길면 노드가 받지 않습니다.', en: 'One question can be at most {max} characters — the node refuses anything longer.' },
  'chat.input.pick_first': { ko: '먼저 왼쪽에서 테스트할 지식을 고르세요.', en: 'Pick the knowledge to test on the left first.' },
  'chat.input.cancel': { ko: '취소', en: 'Cancel' },
  'chat.input.in_flight': { ko: '답을 기다리는 중입니다. 오래 걸리면 취소할 수 있습니다.', en: 'Waiting for the answer — you can cancel if it takes too long.' },

  // follow-up questions: each column replays its own earlier answers (never the other's)
  'chat.history.split': { ko: '이어지는 질문에서 각 열은 자기가 한 답만 다시 보게 됩니다 — "넣기 전" 모델에는 지식이 낸 답을 알려주지 않습니다.', en: 'On follow-up questions each column replays only its own earlier answers — the "Before loading" model is never shown what the knowledge answered.' },

  // "Improve & retry" (finding 21) — the failed lesson's corrections come BACK into the basket beside whatever is
  // already there, and the drawer opens on the one that missed, asking for the phrasing the card asked for
  'chat.improve.title': { ko: '표현 하나 더 넣기', en: 'Add another phrasing' },
  'chat.improve.sub': { ko: '이 바로잡기는 수업에 그대로 있습니다. 같은 사실을 다른 말로도 물어볼 수 있게 표현을 하나 더 넣어 주세요 — 모델이 표현이 아니라 사실을 배우는지 확인하는 데 씁니다.', en: 'This correction is still in your lesson. Add one more way of asking the same thing — it is what checks the model learned the fact and not the wording.' },
  'chat.improve.save': { ko: '수업에 저장', en: 'Save to the lesson' },
  'chat.improve.full': { ko: '수업이 이미 가득 차서 지난 수업의 바로잡기 {n}개는 다시 넣지 못했습니다 (한 수업에 최대 {max}개). 몇 개를 빼고 "보완해서 다시"를 한 번 더 누르면 들어갑니다.', en: '{n} corrections from that lesson could not come back: this lesson is already full (up to {max}). Remove a few and press "Improve & retry" again.' },
  'chat.improve.full_one': { ko: '수업이 이미 가득 차서 지난 수업의 바로잡기 1개는 다시 넣지 못했습니다 (한 수업에 최대 {max}개). 하나를 빼고 "보완해서 다시"를 한 번 더 누르면 들어갑니다.', en: '1 correction from that lesson could not come back: this lesson is already full (up to {max}). Remove one and press "Improve & retry" again.' },
  'chat.improve.dismiss': { ko: '닫기', en: 'Dismiss' },

  // transcript — the mark that says which knowledge a run of questions was asked with (finding 14)
  'chat.turn.stack': { ko: '여기부터는 다음 지식을 넣고 물어봤습니다: {names}', en: 'From here: asked with {names} loaded' },
  'chat.turn.stack_none': { ko: '여기부터: 아무 지식도 넣지 않고 물어봤습니다', en: 'From here: asked with no knowledge loaded' },
  'chat.turn.stack_help': { ko: '지식을 체크하거나 해제해도 질문과 답은 지워지지 않습니다. 모두 여기 남고, 물어볼 당시 넣어져 있던 지식이 표시됩니다. 이어지는 질문에는 같은 조합으로 받은 답만 모델에 다시 보냅니다.', en: 'Ticking or unticking a knowledge never deletes your questions — they all stay here, marked with what was loaded when you asked them. Follow-up questions replay only the answers from the same combination.' },

  // the lesson kept under another selection (finding 14)
  'chat.basket.stranded': { ko: '다음 지식을 넣었을 때 만든 바로잡기 {n}개가 그대로 저장되어 있습니다: {names}', en: '{n} corrections you made with {names} loaded are still saved.' },
  'chat.basket.stranded_one': { ko: '다음 지식을 넣었을 때 만든 바로잡기 1개가 그대로 저장되어 있습니다: {names}', en: '1 correction you made with {names} loaded is still saved.' },
  'chat.basket.stranded_none': { ko: '아무 지식도 넣지 않았을 때 만든 바로잡기 {n}개가 그대로 저장되어 있습니다.', en: '{n} corrections you made with no knowledge loaded are still saved.' },
  'chat.basket.stranded_none_one': { ko: '아무 지식도 넣지 않았을 때 만든 바로잡기 1개가 그대로 저장되어 있습니다.', en: '1 correction you made with no knowledge loaded is still saved.' },
  'chat.basket.stranded_go': { ko: '그 수업 열기', en: 'Open that lesson' },

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
  // Finding 229 — the wait grows with what was ticked (a measured two-knowledge turn took 317 s), so the line says
  // how much is being loaded. The only number of seconds ever printed is one this session actually measured.
  'chat.bubble.loading': { ko: '지식 {n}개를 모델에 넣었다 빼는 중입니다 — 넣는 양이 많을수록 오래 걸립니다.', en: 'Loading {n} knowledges into the model and taking them out again — the more you load, the longer it takes.' },
  'chat.bubble.loading_one': { ko: '지식을 모델에 넣었다 빼는 중입니다 — 수십 초 걸릴 수 있습니다.', en: 'Loading the knowledge into the model and taking it out again — this can take tens of seconds.' },
  'chat.bubble.loading_size': { ko: '지식 {n}개({mb} MB)를 모델에 넣었다 빼는 중입니다 — 넣는 양이 많을수록 오래 걸립니다.', en: 'Loading {n} knowledges ({mb} MB) into the model and taking them out again — the more you load, the longer it takes.' },
  'chat.bubble.loading_size_one': { ko: '지식({mb} MB)을 모델에 넣었다 빼는 중입니다 — 수십 초 걸릴 수 있습니다.', en: 'Loading the knowledge ({mb} MB) into the model and taking it out again — this can take tens of seconds.' },
  'chat.bubble.last_time': { ko: '같은 조합이 지난번에는 {n}초 걸렸습니다', en: 'the same set took {n}s last time' },
  'chat.bubble.empty_answer': { ko: '(빈 답변)', en: '(empty answer)' },
  // D1 — what the visitor is told when the guard cut a runaway answer
  'chat.trunc.repetition': { ko: '모델이 같은 말을 반복하기 시작해서 답을 여기서 잘랐습니다. 보통은 이 지식이 다루지 않는 질문일 때 이렇게 됩니다.', en: 'The model started repeating itself, so the answer is cut off here — that usually means the question is outside what this knowledge covers.' },
  // Finding 64 — the out-of-scope hypothesis is dropped where the same bubble just marked the answer correct.
  'chat.trunc.repetition_hit': { ko: '답을 낸 뒤 모델이 같은 말을 반복하기 시작해서 나머지를 잘랐습니다.', en: 'The model repeated itself after this answer, so the rest was cut.' },
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
  // Finding 223 — two ticks under one answer are not two confirmations: there is ONE answer, checked against each
  // knowledge's own expected value, which is also why a ✓ and a ✗ can sit side by side.
  'chat.hit.one_answer': { ko: '답은 하나입니다 — 넣은 지식마다 자기 기대 답과 비교했습니다:', en: 'One answer, checked against each knowledge’s own expected value:' },
  'chat.turn.retry': { ko: '다시 시도', en: 'Retry' },
  // Finding 58 — thinking shares the answer's token budget, so a thinking turn often comes back cut off or empty.
  'chat.turn.ask_again': { ko: '생각 과정 끄고 다시 물어보기', en: 'Ask again without thinking' },

  // errors (plain Korean; server messages are mapped in ChatPage)
  'chat.err.no_body': { ko: '이 노드에 지식 본문이 없습니다. 판매 노드에서 테스트하거나 먼저 구매하세요.', en: 'This node does not have the knowledge body. Test it on the seller’s node or buy it first.' },
  // Finding 57 — the bubble says what became of THIS question; the offer is made once, under the question box.
  'chat.err.quota': { ko: '이 질문은 보내지 않았습니다 — 이 시간 무료 체험을 모두 썼습니다.', en: 'This question was not sent — you have no free tries left this hour.' },
  'chat.err.busy': { ko: '공유 모델이 오래 잡혀 있어 기다리다 포기했습니다. 잠시 후 다시 시도하세요.', en: 'The shared model stayed busy for too long, so this request gave up waiting. Try again in a moment.' },
  'chat.err.runtime': { ko: '모델 서버가 꺼져 있거나 응답하지 않습니다. 잠시 후 다시 시도하세요.', en: 'The model server is off or not responding. Try again in a moment.' },
  'chat.err.model': { ko: '이 지식은 이 노드가 서비스하는 모델과 다른 모델용이라 테스트할 수 없습니다.', en: 'This knowledge targets a different model than the one this node serves.' },
  'chat.err.not_found': { ko: '해당 지식을 찾을 수 없습니다. 목록에서 다시 골라 주세요.', en: 'That knowledge could not be found. Pick one from the list again.' },
  'chat.err.network': { ko: '노드에 연결할 수 없습니다. 네트워크 상태를 확인하고 다시 시도하세요.', en: 'Could not reach the node. Check your connection and try again.' },
  'chat.err.timeout': { ko: '답을 기다리다 시간이 초과되었습니다. 생각 과정을 끄거나 잠시 후 다시 시도하세요.', en: 'Timed out waiting for the answer. Turn thinking off or try again shortly.' },
  'chat.err.generic': { ko: '테스트 중 문제가 생겼습니다: {message}', en: 'Something went wrong during the test: {message}' },
  'chat.err.cancelled': { ko: '요청을 취소했습니다.', en: 'Request cancelled.' },
  // Finding 61 — this used to blame the conversation and tell the visitor to clear it, which could not help: the
  // node refuses ONE message longer than 4,000 characters. The question is now back in the box to be shortened.
  'chat.err.too_long': { ko: '질문이 4,000자를 넘습니다. 줄여서 다시 보내 주세요 — 질문은 입력창에 그대로 있습니다.', en: 'That question is longer than 4,000 characters. Shorten it and send again — it is back in the box.' },

  // developer note
  'chat.dev.title': { ko: '노드 운영자·개발자', en: 'Node operators & developers' },
  'chat.dev.body': { ko: '이 화면은 노드의 POST /api/chat을 호출합니다(patch_id 또는 patch_ids[1..3]). 요청마다 공유 모델 잠금 아래에서 [지식 빼기 → 넣기 전 답] → [체크한 순서대로 넣기 → 넣은 후 답] → 역순으로 원상 복구 순으로 실행되며, 넣은 후 답변은 지식마다 하나씩 사용 기록(hit)으로 계량됩니다. 운영자가 항상 넣어 둔 지식은 GET /api/chat/patches의 applied[]에 나옵니다.', en: 'This page calls the node’s POST /api/chat (patch_id or patch_ids[1..3]). Each request runs under the shared runtime lock: [unload → base answer] → [load in tick order → patched answer] → restore in reverse, and every patched answer is metered as one usage hit per knowledge. Knowledge the operator keeps loaded is listed in GET /api/chat/patches applied[].' },
};
