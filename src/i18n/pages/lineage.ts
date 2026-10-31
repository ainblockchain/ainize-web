import type { Dict } from '../index';

/**
 * Lineage L6 — the family tree, the training-set block, the "doing well" strip, the open-questions panel, the chat
 * consent line and the Explore shelves (`docs/lineage-teach-design.md` §4, SC-9 … SC-13 and SC-17).
 * The strings are the design's, verbatim. Where the design writes a slash-joined list for a row of BUTTONS
 * ("Teach on top of this / Copy and continue / …"), each button gets its own key with its own segment — a button
 * cannot be labelled with three other buttons — and the composite line is kept where it really is one line.
 */
export const lineageTree: Dict = {
  // ---------------------------------------------------------------- SC-9 knowledge page header and Family tree tab
  'detail.build_on': { ko: '이 지식 위에 만들기', en: 'Build on this' },
  'detail.build_on_private': { ko: '창작자가 학습 문답을 비공개로 두어 이어 만들 수 없습니다.', en: 'The creator kept the training set private, so nobody can build on it.' },
  // §14: an anchor from before training sets were kept has no questions to continue from — which is not a decision
  // its creator made, and must not be reported as one.
  'detail.build_on_none': { ko: '이 지식에는 기록된 학습 문답이 없어 이어 만들 수 있는 질문이 없습니다.', en: 'This knowledge has no training set on the record, so there are no questions to continue from.' },
  'detail.addon_badge': { ko: '{name} 추가분 · 사용하려면 {name} 필요', en: 'Add-on to {name} · needs {name} to use' },
  'detail.tab.tree': { ko: '계보도', en: 'Family tree' },
  'detail.tree.legend': { ko: '기반 / 위에 만든 지식 / 수정판 / 새 버전 / 다른 맥락용 / 합쳐서 만듦', en: 'Base / Built on it / Correction / Newer version / Different context / Combined from' },
  'detail.tree.k.base': { ko: '기반', en: 'Base' },
  'detail.tree.k.extend': { ko: '위에 만든 지식', en: 'Built on it' },
  'detail.tree.k.contradict': { ko: '수정판', en: 'Correction' },
  'detail.tree.k.update': { ko: '새 버전', en: 'Newer version' },
  'detail.tree.k.version': { ko: '새 버전', en: 'Newer version' },
  'detail.tree.k.track': { ko: '다른 맥락용', en: 'Different context' },
  'detail.tree.k.merge': { ko: '합쳐서 만듦', en: 'Combined from' },
  'detail.tree.k.declared': { ko: '부모로 표시됨', en: 'Declared parent' },
  'detail.tree.added': { ko: '질문 {m}개 추가 · {k}개 수정 · 행 {rows}개 (새 행 {new}개)', en: '+{m} questions · {k} changed · {rows} rows ({new} new)' },
  'detail.tree.node_hover': { ko: '{name} · {teacher} 가르침 · 판매 {sales} · 노드 {loads}곳에 로드 · 바탕 {c}회', en: '{name} · taught by {teacher} · {sales} sales · loaded on {loads} nodes · built on {c}×' },
  'detail.tree.missing': { ko: '알 수 없는 지식 {id} (이 노드에 없음)', en: 'Unknown knowledge {id} (not on this node)' },
  'detail.tree.legacy': { ko: '부모로 표시됨 — 그 위에서 학습되진 않음', en: 'Declared parent — not trained on top' },
  'detail.tree.family': { ko: '이 계보: 판매 {sales} · 지식 {n}개 · 제작자 {authors}명', en: 'This family: {sales} sales · {n} knowledges · {authors} creators' },
  'detail.tree.money': { ko: '판매 1건당: {seller_name}에게 {seller}%, {lineage}%는 {names} 제작자에게', en: 'Each sale: {seller}% to {seller_name}, {lineage}% shared by the creators of {names}' },
  // The other half of the same sale. SC-9 writes only the lineage line, but a page that says where 30 % goes and
  // stays silent about the other 70 % reads as if the rest were the seller's — on a teaching node it is not.
  'detail.tree.money_contrib': { ko: '같은 판매에서 {pct}%는 이 지식에 이름이 올라간 제작자({names})에게 갑니다.', en: 'Of the same sale, {pct}% goes to the creators credited on this knowledge: {names}.' },
  // item 325 — the fourth party in every sale: the nodes whose verification keeps it on sale.
  'detail.tree.money_verify': { ko: '같은 판매에서 {pct}%는 이 지식을 검증한 노드 {n}곳이 나눠 받습니다.', en: 'Of the same sale, {pct}% is divided among the {n} node(s) whose verification keeps it on sale.' },
  'detail.tree.btn_teach': { ko: '이 위에 가르치기', en: 'Teach on top of this' },
  'detail.tree.btn_copy': { ko: '복사해서 이어 만들기', en: 'Copy and continue' },
  'detail.tree.btn_combine': { ko: '합치기…', en: 'Combine with…' },
  'detail.tree.btn_questions': { ko: '질문 받기', en: 'Get its questions' },
  'detail.tree.corrections': { ko: '수정판 {n}개', en: 'Corrections available ({n})' },
  'detail.tree.adopt': { ko: '이 수정판을 다음 버전에 반영하기', en: 'Adopt this correction into your next version' },
  'detail.tree.this': { ko: '이 지식', en: 'This knowledge' },
  'detail.tree.empty': { ko: '이 지식은 아무것도 위에 만들지 않았고, 아직 아무도 위에 만들지 않았습니다.', en: 'This knowledge was not built on anything, and nothing has been built on it yet.' },
  'detail.tree.truncated': { ko: '{depth}단계에서 멈췄습니다 — 더 보려면 깊이를 늘리세요.', en: 'Stopped at {depth} steps — raise the depth to see more.' },
  'detail.tree.depth': { ko: '깊이', en: 'Depth' },
  'detail.tree.off': { ko: '이 노드는 아직 "이 위에 만들기"를 켜지 않았습니다. 계보는 그대로 볼 수 있습니다.', en: 'This node has not turned on building on other knowledge yet. The family tree is still readable.' },

  // ---------------------------------------------------------------- SC-10 training set block
  'detail.ds.title': { ko: '학습 문답', en: 'Training set' },
  'detail.ds.line': { ko: '문답 {n}개 · {access} · {license}', en: '{n} questions · {access} · {license}' },
  'detail.ds.access_derivative': { ko: '이어 만드는 사람에게 제공', en: 'available to anyone who builds on it' },
  'detail.ds.access_public': { ko: '공개', en: 'public' },
  'detail.ds.access_private': { ko: '비공개', en: 'private' },
  'detail.ds.private_note': { ko: '학습 문답: 비공개. 검증용 질문 {n}개만 공개됩니다.', en: 'Training set: private. Only the {n} verification questions are public.' },
  'detail.ds.btn_preview': { ko: '문답 20개 미리보기', en: 'Preview 20 questions' },
  'detail.ds.btn_copy': { ko: '복사해서 이어 만들기', en: 'Copy and continue' },
  'detail.ds.btn_download': { ko: '내려받기', en: 'Download' },
  'detail.ds.unavailable': { ko: '이 노드에서 학습 문답을 구할 수 없습니다 (보유한 노드 없음).', en: 'Training set not available on this node (no peer holds it).' },
  'detail.ds.derivative_only': { ko: '이 위에 만드는 사람에게 제공되는 문답입니다. 미리 보려면 가르치기 키로 서명하세요.', en: 'These questions are shared with people building on this knowledge — sign in with a teaching key to preview them.' },
  'detail.ds.h_question': { ko: '질문', en: 'Question' },
  'detail.ds.h_answer': { ko: '답', en: 'Answer' },

  // ---------------------------------------------------------------- SC-11 doing-well strip
  /**
   * Six independent counts in one sentence, so no one of them can carry a plural: at 1 it read "Loaded on 1 nodes".
   * Every metric is a label followed by its number instead, which is grammatical at 0, 1 and 12 — and `{c}` is
   * named with the word the tab above it already uses for the same thing ("Origins & derivatives" / 기반과 파생),
   * which also takes it out of the "Built on" collision of item 282.
   */
  'detail.signals.strip': { ko: '판매 {s} · 로드한 노드 {l} · 실전 테스트 {t}회 (✓{h}) · 파생 지식 {c} · 트랙 구독 {w} · 검증 {p}/{q}', en: 'Sales {s} · Nodes loaded {l} · Live tests {t} (✓{h}) · Derivatives {c} · Track subscribers {w} · Verified {p}/{q}' },
  'detail.signals.scope_net': { ko: '네트워크', en: 'Network' },
  'detail.signals.scope_node': { ko: '이 노드, 최근 30일', en: 'This node, last 30 days' },
  // the design gives the two scope LABELS; this line is what puts each number under the right one
  'detail.signals.scope_note': { ko: '판매·로드·바탕·구독·검증은 {net} 기준, 실전 테스트는 {node} 기준입니다.', en: 'Sales, loads, built-on, subscribers and verification are {net}; live tests are {node}.' },

  // ---------------------------------------------------------------- SC-12 "what to add on top of this"
  'detail.missing.title': { ko: '이 위에 무엇을 더하면 좋을까요? ({n})', en: 'What to add on top of this ({n})' },
  'detail.missing.own': { ko: '실전 테스트에서 틀린 자기 질문 ({total}개 중 {k}개)', en: 'Its own questions it got wrong in live tests ({k} of {total})' },
  'detail.missing.preflight': { ko: '사람들이 이 위에 가르치려 한 질문 ({k}개, {u}명): {clusters}', en: 'Questions people tried to teach on top of it ({k}, {u} people): {clusters}' },
  'detail.missing.free': { ko: '틀렸다고 표시된 자유 질문 ({k}개) — 방문자가 공유한 것 {shared}개', en: 'Free questions marked wrong ({k}) — {shared} shared by visitors' },
  'detail.missing.requests': { ko: '구매자 요청 ({k}개)', en: 'Requested by buyers ({k})' },
  'detail.missing.gap': { ko: '{topic}에서 빠진 부분 ({k}개)', en: 'Coverage gaps in {topic} ({k})' },
  'detail.missing.count': { ko: '{c}번 물어봄', en: 'asked {c} times' },
  'detail.missing.covered': { ko: '{child}이(가) 해결함', en: 'covered by {child}' },
  'detail.missing.teach': { ko: '이 위에 가르치기', en: 'Teach this on top' },
  'detail.missing.request': { ko: '제작자에게 요청하기…', en: 'Ask the creator to add…' },
  'detail.missing.empty': { ko: '아직 보고된 것이 없습니다. 채팅에 넣고 이것저것 물어보세요.', en: 'Nothing reported yet. Load it in Chat and ask around.' },
  'detail.missing.hidden': { ko: '본문은 저장하지 않고 횟수만 셉니다', en: 'counted, not kept — nobody shared the wording' },
  'detail.missing.scope': { ko: '이 노드에서 일어난 일만 셉니다.', en: 'Counted on this node only.' },
  'detail.missing.ask_placeholder': { ko: '이 지식이 답했으면 하는 질문', en: 'A question you want this knowledge to answer' },
  'detail.missing.ask_share': { ko: '내 질문 본문을 제작자에게 보내기', en: 'Send the wording to the creator' },
  'detail.missing.ask_send': { ko: '요청 보내기', en: 'Send request' },
  'detail.missing.ask_done': { ko: '보냈습니다 — 지금까지 {c}번 요청된 질문입니다.', en: 'Sent — this question has now been asked {c} times.' },

  // ---------------------------------------------------------------- SC-13 chat per-turn consent
  'chat.mark_wrong': { ko: '틀림 표시', en: 'Mark wrong' },
  'chat.share_q': { ko: '이 질문을 {name} 제작자에게 보낼까요? (보내면 본문이 보이고, 아니면 횟수만 셉니다)', en: "Share this question with {name}'s creator? (they see the text; otherwise only a count)" },
  'chat.share_yes': { ko: '보내기', en: 'Share' },
  'chat.share_no': { ko: '횟수만', en: 'Count only' },
  'chat.share_done': { ko: '기록했습니다 · 지금까지 {c}번', en: 'Recorded · {c} times so far' },
  'chat.share_failed': { ko: '기록하지 못했습니다: {message}', en: 'Could not record it: {message}' },

  // ---------------------------------------------------------------- SC-17 Explore shelves
  'explore.shelf.selling': { ko: '잘 팔리는 지식', en: 'Selling now' },
  'explore.shelf.built_on': { ko: '위에 만들어지고 있는 지식', en: 'Being built on' },
  'explore.shelf.fresh': { ko: '새로 나온 지식', en: 'Just published' },
  'explore.shelf.asked': { ko: '사람들이 찾는 지식 (이 노드 기준)', en: 'Asked for (this node)' },
  'explore.shelf.asked_row': { ko: '{topic} — {n}번 요청 — 아직 아무도 가르치지 않음', en: '{topic} — asked {n} times — nobody teaches it yet' },
  'explore.shelf.asked_teach': { ko: '가르치기', en: 'Teach this' },
  'explore.sort.built_on': { ko: '바탕으로 많이 쓰임', en: 'Most built on' },
  'explore.sort.trending': { ko: '이번 주 인기', en: 'Doing well this week' },
  /**
   * Item 282 — this counts the knowledges built ON this one, and it sat one card away from `item.built_on`
   * ("Built on {names}"), which names what a knowledge is built FROM. On /explore the base read "Built on 1×" and
   * the derivative right under it read "Built on AV base two": the same two words for opposite directions. The
   * count says whose side it is on now. `explore.sort.built_on` above is the sort over this same number and keeps
   * its wording — a sort label is read against the other sorts, not against the card.
   */
  'explore.card.built_on': { ko: '이 위에 만든 지식 {c}개', en: '{c} built on this' },
  'explore.card.needs': { ko: '{name} 필요', en: 'Needs {name}' },
  'explore.card.sales': { ko: '최근 30일 판매 {n}건', en: '{n} sales in 30 days' },
  'explore.card.rows': { ko: '기억 항목 {n}개', en: '{n} memory entries' },
  'explore.shelf.empty': { ko: '아직 없습니다.', en: 'Nothing here yet.' },

  // ---------------------------------------------------------------- SC-15 buy / apply for a child (§4, §8, §12.4)
  // The chain is listed by `detail.buy.needs_*`, which this node already had. What was missing is the sentence a
  // buyer needs BEFORE paying twice: the base's creators are paid for the base AND out of this sale. `{lineage}` is
  // read from the tree's money line, which is computed by the splitter that will settle the sale (§11) — never a
  // constant, and never printed when the node cannot compute it.
  'detail.buy.twice_note': { ko: '{name} 제작자는 {name} 판매 대금과 이 판매의 {lineage}%를 함께 받습니다.', en: "{name}'s creators are paid for {name} and receive {lineage}% of this sale too." },
  'detail.apply.review.title': { ko: '모델 적용 내용 확인', en: 'Review model changes' },
  'detail.apply.review.load': { ko: '새로 적용', en: 'Load' },
  'detail.apply.review.reuse': { ko: '이미 적용됨 · 유지', en: 'Already loaded · keep' },
  'detail.apply.review.alias': { ko: '같은 파일 · 적용 이름: {id}', en: 'Same file · layer: {id}' },
  'detail.apply.review.file': { ko: '항목·파일 확인', en: 'Item and file details' },
  'detail.apply.review.preserved': { ko: '기존 적용 {n}개 유지', en: 'Keep {n} existing layers' },
  'detail.apply.review.confirm': { ko: '확인한 내용 적용', en: 'Apply reviewed changes' },
  'detail.apply.review.confirmed': { ko: '확인한 항목과 순서대로 적용 기록을 확인했습니다.', en: 'Confirmed load records match the reviewed items and order.' },
  'detail.apply.needs_base': { ko: '{child}은(는) {parent} 위에 만든 지식입니다. {parent}을(를) 먼저 넣을까요?', en: '{child} is built on {parent}. Load {parent} first?' },
  'detail.apply.load_both': { ko: '선행 지식과 함께 넣기', en: 'Load with prerequisites' },
  'detail.apply.order': { ko: '확인된 적용 기록 순서: {parent} → {child}', en: 'Confirmed load record order: {parent} → {child}' },
  'detail.apply.loaded_record': { ko: '{id}의 적용 기록을 확인했습니다.', en: 'Confirmed the load record for {id}.' },
  'detail.apply.removed_record': { ko: '{id}의 적용 기록이 제거됐음을 확인했습니다.', en: 'Confirmed removal of the load record for {id}.' },
  'detail.apply.already_recorded': { ko: '{id}은(는) 이미 적용된 것으로 기록돼 있습니다.', en: '{id} is already recorded as loaded.' },
  'detail.apply.alias': { ko: '{id}과(와) 같은 파일이 {alias} 이름으로 적용된 것으로 기록돼 있습니다.', en: 'The same file as {id} is recorded as loaded under {alias}.' },
  'detail.apply.error.access': { ko: '현재 계정의 운영 권한이나 노드가 바뀌었습니다. 다시 확인하세요.', en: 'The current operator account or node has changed. Check access before continuing.' },
  'detail.apply.error.read': { ko: '선택한 지식과 파일을 확인할 수 없습니다. 최신 상태를 확인한 뒤 시도하세요.', en: 'The selected knowledge or its file could not be confirmed. Check its current state before trying again.' },
  'detail.apply.error.changed': { ko: '선택한 지식, 선행 지식 또는 현재 적용 상태가 바뀌었습니다. 다시 선택해 최신 내용을 확인하세요.', en: 'The selected knowledge, prerequisites or current load records have changed. Select it again to review the latest changes.' },
  'detail.apply.error.unavailable': { ko: '모델 실행 환경과 적용 기록을 확인할 수 없습니다. 상태를 새로고침하세요.', en: 'The model runtime and its load records could not be confirmed. Refresh their status.' },
  'detail.apply.error.not_loaded': { ko: '현재 이 지식의 적용 기록이 없어 제거하지 않았습니다. 최신 적용 상태를 확인하세요.', en: 'This knowledge has no current load record, so no removal was performed. Check the latest load status.' },
  'detail.apply.error.order': { ko: '현재 적용 순서가 이 지식에 필요한 선행 지식 순서와 맞지 않습니다. 기존 적용 기록을 검토하세요.', en: 'The recorded order does not match this knowledge’s required base order. Review the existing load records.' },
  'detail.apply.error.restore': { ko: '이전 상태를 복원하는 데 필요한 파일이 없어 제거하지 않았습니다. 노드의 파일과 적용 기록을 확인하세요.', en: 'A file needed to restore the previous state is missing, so removal was not performed. Check the node’s files and load records.' },
  'detail.apply.error.recovery': { ko: '이전 모델 작업의 복구가 아직 확인되지 않았습니다. 복구가 끝난 뒤 적용 상태를 다시 확인하세요.', en: 'Restoration after the previous model operation is not yet confirmed. Check the load status again once recovery completes.' },
  'detail.apply.error.unconfirmed': { ko: '요청 결과와 현재 적용 기록이 일치하는지 확인하지 못했습니다. 작업 상태를 다시 확인하세요.', en: 'The operation result could not be confirmed against current load records. Check the original operation again.' },
  'detail.operation.title': { ko: '모델 작업 상태', en: 'Model operation status' },
  'detail.operation.load': { ko: '적용', en: 'Load' },
  'detail.operation.unload': { ko: '제거', en: 'Unload' },
  'detail.operation.submitting': { ko: '요청 전송 중', en: 'Sending request' },
  'detail.operation.checking': { ko: '기존 작업 확인 중', en: 'Checking existing operation' },
  'detail.operation.queued': { ko: '차례를 기다리는 중', en: 'Waiting in queue' },
  'detail.operation.running': { ko: '실행 중', en: 'Running' },
  'detail.operation.confirming': { ko: '현재 적용 기록 확인 중', en: 'Confirming current load records' },
  'detail.operation.interrupted': { ko: '결과 확인 필요', en: 'Result needs checking' },
  'detail.operation.retry': { ko: '작업 상태 다시 확인', en: 'Check operation again' },
  'detail.operation.review': { ko: '현재 기록 검토', en: 'Review current records' },
  'detail.operation.review_note': { ko: '아래는 방금 읽은 적용 기록입니다. 추적을 닫아도 서버 작업이 취소되지는 않으며, 원래 요청의 성공을 뜻하지도 않습니다. 작업 기록이 사라졌다면 실행 여부를 단정할 수 없습니다. 다시 실행하기 전에 이 상태를 검토하세요.', en: 'These load records were just read. Closing tracking does not cancel server work or confirm that the original request succeeded. A missing job does not prove whether it ran. Review this state before deciding to run anything again.' },
  'detail.operation.empty': { ko: '현재 적용 기록이 없습니다.', en: 'There are no current load records.' },
  'detail.operation.dismiss': { ko: '기록을 확인하고 추적 닫기', en: 'Acknowledge records and close tracking' },
  'detail.operation.closed': { ko: '추적을 닫았습니다. 새 작업은 보내지 않았습니다.', en: 'Tracking closed. No new operation was sent.' },
  'detail.operation.error.unsupported': { ko: '이 노드의 작업 추적 기능을 확인할 수 없어 요청을 보내지 않았습니다. 노드 연결이나 업데이트 상태를 확인하세요.', en: 'This node’s operation tracking could not be confirmed, so no operation was sent. Check its connection or update status.' },
  'detail.operation.error.storage': { ko: '이 브라우저에 작업 추적 정보를 보관하거나 읽을 수 없습니다. 저장 공간과 브라우저 지원 여부를 확인하세요.', en: 'This browser cannot retain or read the operation tracking record. Check browser storage and support.' },
  'detail.operation.error.pending': { ko: '이 계정에서 추적 중인 모델 작업이 있습니다. 기존 작업의 상태를 먼저 확인하세요.', en: 'This account already has a tracked model operation. Check that operation first.' },
  'detail.operation.error.receipt': { ko: '응답이 원래 작업과 일치하지 않아 완료로 표시하지 않았습니다. 작업 상태를 다시 확인하세요.', en: 'The response does not match the original operation. Check its status again; completion has not been confirmed.' },
  'detail.operation.error.review': { ko: '확인한 적용 내용이나 서버 상태가 바뀌어 요청을 보내지 않았습니다. 다시 선택해 최신 내용을 확인하세요.', en: 'The reviewed changes or server state changed, so no request was sent. Select the item again to review the latest changes.' },
  'detail.operation.error.unreachable': { ko: '작업 상태를 읽지 못했습니다. 요청을 다시 실행하지 않고 추적 정보를 유지했습니다.', en: 'The operation status could not be read. Its tracking record is retained; no operation was resubmitted.' },
  'detail.operation.error.missing': { ko: '서버에서 작업 기록을 찾지 못했습니다. 서버 재시작이나 기록 만료일 수 있으며 실행 여부는 아직 모릅니다. 현재 기록을 검토하세요.', en: 'The server has no record of this job. It may have restarted or expired the receipt; execution is still unknown. Review current records.' },
  'detail.apply.error.mismatch': { ko: '현재 모델 상태가 이 지식의 기준과 다릅니다. 적용된 선행 지식과 순서를 확인하세요.', en: 'The current model state differs from this knowledge’s required baseline. Check its loaded prerequisites and their order.' },
  'detail.apply.has_dependents': { ko: '{parent}을(를) 빼려면 {children}을(를) 먼저 빼세요.', en: 'Remove {children} before removing {parent}.' },
  'detail.apply.mismatch': { ko: '모델에 {child}이(가) 기대하는 상태로 {parent}이(가) 올라가 있지 않습니다 (다른 것이 이 행을 바꿨습니다). {parent}을(를) 다시 넣고 시도하세요.', en: 'The model does not have {parent} loaded the way {child} expects (something else changed these rows). Reload {parent} and try again.' },
};
