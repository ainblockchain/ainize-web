import type { Dict } from '../index';

/**
 * Lineage L7 — the merge screen (`docs/lineage-teach-design.md` §4 SC-14, `/teach/merge?a=&b=`).
 *
 * The design's strings, verbatim. Where SC-14 writes one line for a ROW OF BUTTONS ("Keep {A}'s / Keep {B}'s / Write
 * my own / Drop this question"), each button gets its own key with its own segment — a button cannot be labelled with
 * three other buttons — and the sentence that is really one sentence stays one key.
 */
export const mergeScreen: Dict = {
  // the way in, on the knowledge page beside *Teach on top of this* and *Copy and continue* (§9 / SC-9's button row)
  'detail.tree.btn_merge': { ko: '다른 지식과 합치기', en: 'Combine with another' },
  'merge.title': { ko: '{A} + {B} 합치기', en: 'Combine {A} + {B}' },
  'merge.steps': { ko: '겹침 / 서로 다른 답 / 다시 만들 방법 / 검증', en: 'Overlap / Different answers / How to build / Checking' },
  'merge.step.overlap': { ko: '겹침', en: 'Overlap' },
  'merge.step.conflicts': { ko: '서로 다른 답', en: 'Different answers' },
  'merge.step.build': { ko: '다시 만들 방법', en: 'How to build' },
  'merge.step.check': { ko: '검증', en: 'Checking' },
  'merge.questions': { ko: '질문: {A}에만 {a} · {B}에만 {b} · 같음 {same} · 같은 질문 다른 답 {conf}', en: 'Questions: {a} only in {A} · {b} only in {B} · {same} same · {conf} same question, different answer' },
  'merge.rows': { ko: '행: {A}만 {ra} · {B}만 {rb} · 둘 다 쓴 행 {shared} (다른 값 {dis})', en: 'Rows: {ra} only in {A} · {rb} only in {B} · {shared} written by both ({dis} disagree)' },
  'merge.conflict_card': { ko: '{A}의 답: {a_answer} · {B}의 답: {b_answer}', en: '{A} says: {a_answer} · {B} says: {b_answer}' },
  'merge.keep_a': { ko: '{A} 답 유지', en: 'Keep {A}’s' },
  'merge.keep_b': { ko: '{B} 답 유지', en: 'Keep {B}’s' },
  'merge.own': { ko: '직접 쓰기', en: 'Write my own' },
  'merge.own_ph': { ko: '이 질문의 답', en: 'The answer to this question' },
  'merge.drop': { ko: '이 질문 빼기', en: 'Drop this question' },
  'merge.bulk_a': { ko: '모두 {A} 답으로', en: 'Prefer {A} everywhere' },
  'merge.bulk_b': { ko: '모두 {B} 답으로', en: 'Prefer {B} everywhere' },
  'merge.unresolved': { ko: '아직 고르지 않은 질문 {n}개', en: '{n} questions still need a choice' },
  'merge.tier_union': { ko: '바로 합치기 — 학습 없음 (겹치는 행이 같을 때만)', en: 'Just combine — no training (only when rows do not disagree)' },
  'merge.tier_union_off': { ko: '불가: 겹치는 행 {dis}개의 값이 다릅니다.', en: 'Not available: {dis} shared rows disagree.' },
  'merge.tier_retrain': { ko: '서로 다른 질문 {d}개만 두 지식 위에서 다시 학습 (~{min}분)', en: 'Retrain the {d} disagreeing questions on top of both (~{min} min)' },
  'merge.tier_rebuild': { ko: '합친 질문 전체로 처음부터 다시 만들기 (~{h}시간, 최고 품질)', en: 'Rebuild everything from the combined questions (~{h} h, best quality)' },
  // §4 SC-14 writes the estimate into both labels; this node has not always measured one, and "~? min" is not a
  // time. Where there is no measurement the label drops the parenthetical instead of printing a placeholder.
  'merge.tier_retrain_untimed': { ko: '서로 다른 질문 {d}개만 두 지식 위에서 다시 학습', en: 'Retrain the {d} disagreeing questions on top of both' },
  'merge.tier_rebuild_untimed': { ko: '합친 질문 전체로 처음부터 다시 만들기 (최고 품질)', en: 'Rebuild everything from the combined questions (best quality)' },
  'merge.tier_untimed': { ko: '이 노드는 아직 재구축 시간을 잰 적이 없습니다 — 수 시간이 걸릴 수 있습니다.', en: 'This node has not timed a rebuild yet — it may take hours.' },
  'merge.result': { ko: '{A}의 질문 통과 {m}/{n} · {B}의 질문 통과 {p}/{q} · 고른 답 {r}/{s}', en: 'Passes {A}’s questions {m}/{n} · Passes {B}’s questions {p}/{q} · Resolved answers {r}/{s}' },
  'merge.footer': { ko: '두 제작자가 {lineage}%를 똑같이 나눕니다. 구매자는 둘 다 필요합니다.', en: 'Creators of {A} and {B} share {lineage}% equally. Buyers need both.' },
  // SC-14's footer is true of a merge that is an ADD-ON to both (a retrain, or a combine over a shared base): the
  // buyer really does have to load them. A combined stand-alone file carries both parents' rows, so saying it would
  // be a false claim about what a buyer needs — the money half stays, the loading half is replaced.
  'merge.footer_squash': { ko: '두 제작자가 {lineage}%를 똑같이 나눕니다. 합친 지식은 그 자체로 동작하므로 구매자는 둘 다 필요하지 않습니다.', en: 'Creators of {A} and {B} share {lineage}% equally. The combined knowledge stands on its own — buyers do not need either.' },
  'merge.private_parent': { ko: '{name}의 질문이 비공개라 "바로 합치기"만 가능하며, 행이 겹치지 않을 때만 됩니다.', en: '{name}’s questions are private: only "Just combine" is possible, and only if the rows do not overlap.' },

  // ---------------------------------------------------------------- beyond SC-14: what the screen cannot leave unsaid
  // §9 forbids an additive or averaged merge. A screen that only offers three buttons has to say why there is no
  // fourth, or the absence reads as a missing feature rather than a measurement.
  'merge.no_average': { ko: '두 지식이 같은 행에 다른 값을 썼다면 섞거나 더하지 않습니다 — 어느 쪽도 측정한 적 없는 값이 되기 때문입니다. 다시 학습하거나 처음부터 다시 만듭니다.', en: 'Where the two wrote different values into the same row, they are never blended or added — that would be a value neither of them ever measured. It is retrained, or rebuilt.' },
  'merge.tier_title': { ko: '어떻게 만들까요?', en: 'How should it be built?' },
  'merge.tier_required': { ko: '겹치는 행의 {pct}%가 다릅니다 — 처음부터 다시 만들어야 합니다.', en: '{pct}% of the shared rows disagree — this one has to be rebuilt.' },
  'merge.tier_off': { ko: '불가: {reason}.', en: 'Not available: {reason}.' },
  'merge.reason.rows_disagree': { ko: '겹치는 행의 값이 다릅니다', en: 'the rows they both write hold different values' },
  'merge.reason.question_conflicts': { ko: '같은 질문에 답이 다릅니다', en: 'they answer some of the same questions differently' },
  'merge.reason.private_parent': { ko: '한쪽 질문이 비공개입니다', en: 'one creator kept their questions private' },
  'merge.reason.stack_mismatch': { ko: '서로 다른 지식 위에 만들어졌습니다', en: 'they were built on top of different knowledges' },
  'merge.reason.dim_mismatch': { ko: '서로 다른 모델용입니다', en: 'they were built for different models' },
  'merge.reason.nothing_to_retrain': { ko: '다시 학습할 질문이 없습니다', en: 'there is no disagreeing question to retrain' },
  'merge.build': { ko: '만들기', en: 'Build it' },
  'merge.building': { ko: '만드는 중…', en: 'Building…' },
  'merge.pick_two': { ko: '합칠 지식 두 개를 고르세요.', en: 'Choose the two knowledges to combine.' },
  'merge.pick_a': { ko: '첫 번째 지식', en: 'First knowledge' },
  'merge.pick_b': { ko: '두 번째 지식', en: 'Second knowledge' },
  'merge.combined_set': { ko: '합친 학습 문답 {n}개 — {A}에서 {ra}개, {B}에서 {rb}개', en: 'Combined training set: {n} questions — {ra} from {A}, {rb} from {B}' },
  'merge.license': { ko: '라이선스: {a} + {b} → {child}', en: 'Licence: {a} + {b} → {child}' },
  // The three numbers of `merge.result` are MEASURED after the build (they are on the result card); before it, the
  // screen says what will be counted instead of printing three dashes shaped like a result.
  'merge.will_check': { ko: '만든 뒤에 확인합니다: {A}의 질문에 여전히 답하는지, {B}의 질문에 답하는지, 그리고 고른 답대로 답하는지 — 각각 따로 셉니다.', en: 'Afterwards it is checked: does the result still answer {A}’s questions, {B}’s questions, and the answers you chose — each counted on its own.' },
  'merge.queued': { ko: '만들기 시작했습니다 — 진행 상황을 봅니다', en: 'Queued — follow it on the lesson page' },
  'merge.failed': { ko: '합치지 못했습니다: {message}', en: 'Could not combine them: {message}' },
  'merge.disabled': { ko: '이 노드에서는 아직 지식 합치기를 할 수 없습니다.', en: 'Combining knowledges is not enabled on this node yet.' },
};
