/**
 * The verifier's own page (item 337) and the parts of a knowledge page that describe the WORK behind a tick
 * (items 179, 330, 331, 338, 340). Keys are namespaced `verifier.*` so no shared dictionary is touched.
 */
import type { Dict } from '../index';

export const VERIFIER: Dict = {
  'verifier.title': { en: 'Verifier', ko: '검증자' },
  'verifier.not_found': { en: 'That is not a node address.', ko: '올바른 노드 주소가 아닙니다.' },
  'verifier.none': {
    en: 'This address has never signed a verification that this node can see.',
    ko: '이 노드가 읽을 수 있는 기록 안에서, 이 주소는 검증에 서명한 적이 없습니다.',
  },
  'verifier.intro': {
    en: 'Everything below is counted from signed records on the public ledger — not from anything this verifier says about itself.',
    ko: '아래 숫자는 모두 공개 원장의 서명된 기록에서 세었습니다. 검증자가 스스로 밝힌 내용은 하나도 들어 있지 않습니다.',
  },
  'verifier.since': { en: 'Verifying since {date}', ko: '{date}부터 검증' },
  'verifier.last': { en: 'Last verification {ago}', ko: '마지막 검증 {ago}' },
  'verifier.never': { en: 'no verification yet', ko: '아직 검증 없음' },

  'verifier.s.attested': { en: 'Verifications signed', ko: '서명한 검증' },
  'verifier.s.passed': { en: 'Passed', ko: '통과' },
  'verifier.s.failed': { en: 'Failed', ko: '실패' },
  'verifier.s.hash_only': { en: 'File hash only', ko: '파일 해시만' },
  'verifier.s.hash_only_help': {
    en: 'The file matched its published hash, but no benchmark was run — this node had no model server that could run it.',
    ko: '파일이 공개된 해시와 일치했지만 벤치마크는 실행하지 않았습니다. 이 노드에 실행할 수 있는 모델 서버가 없었습니다.',
  },
  'verifier.s.knowledges': { en: 'Knowledge items', ko: '지식 항목' },
  'verifier.s.counted': { en: 'Counting today', ko: '지금 인정되는 검증' },
  'verifier.s.counted_help': {
    en: 'How many of its verifications currently count towards a quorum. A record written before an open challenge answers nothing, so it does not count until the verifier measures again.',
    ko: '지금 정족수에 인정되는 검증의 수입니다. 이의 제기 이전에 쓰인 기록은 그 이의에 답한 것이 아니므로, 다시 측정하기 전까지는 인정되지 않습니다.',
  },
  'verifier.s.rechecks': { en: 'Re-measured on purpose', ko: '스스로 다시 측정' },
  'verifier.s.rechecks_help': {
    en: 'Verifications it ran again by choice, without taking the seller off sale.',
    ko: '판매를 멈추지 않고 스스로 다시 실행한 검증입니다.',
  },
  'verifier.s.challenged_after': { en: 'Later challenged', ko: '이후 이의 제기됨' },
  'verifier.s.challenged_after_help': {
    en: 'Its verifications that somebody disputed afterwards. This is the only thing a PASS has ever risked.',
    ko: '이 검증자가 통과시킨 뒤 다른 노드가 이의를 제기한 건수입니다. 통과 판정이 감수하는 위험은 이것뿐입니다.',
  },
  'verifier.s.disagreed': { en: 'Disagreed with a peer', ko: '다른 검증자와 다른 판정' },
  'verifier.s.disagreed_help': {
    en: 'Knowledge items where another verifier reached the opposite verdict.',
    ko: '다른 검증자가 반대 판정을 내린 지식 항목의 수입니다.',
  },
  'verifier.s.raised': { en: 'Challenges raised', ko: '제기한 이의' },
  'verifier.s.upheld': { en: 'upheld', ko: '인정됨' },
  'verifier.s.dismissed': { en: 'dismissed', ko: '기각됨' },
  'verifier.s.open': { en: 'open', ko: '진행 중' },
  'verifier.s.engines': { en: 'Model servers', ko: '모델 서버' },
  'verifier.s.engines_help': {
    en: 'Distinct engines its measurements were run on. One engine behind many verifications is one machine, however many addresses signed them.',
    ko: '측정이 실행된 서로 다른 엔진의 수입니다. 여러 검증이 하나의 엔진에서 나왔다면, 서명한 주소가 몇 개든 기계는 하나입니다.',
  },
  'verifier.s.work': { en: 'Measured work', ko: '측정된 작업량' },
  'verifier.s.work_val': { en: '{samples} questions · {minutes} min', ko: '질문 {samples}개 · {minutes}분' },
  'verifier.s.work_help': {
    en: 'Questions actually asked and model time actually spent, added up over the verifications that record it. Records written before this field do not count towards it.',
    ko: '실제로 물어본 질문 수와 실제로 쓴 모델 시간을, 이를 기록한 검증만 합산한 값입니다. 이 항목이 생기기 전의 기록은 포함되지 않습니다.',
  },
  'verifier.s.no_baseline': { en: 'No baseline', ko: '기준선 없음' },
  'verifier.s.no_baseline_help': {
    en: 'Runs made on a model that already carried the knowledge, so there was nothing to compare against. Recorded, never counted.',
    ko: '해당 지식이 이미 적용된 모델에서 실행되어 비교할 기준이 없던 측정입니다. 기록은 남지만 인정되지 않습니다.',
  },

  'verifier.h.knowledge': { en: 'Knowledge', ko: '지식' },
  'verifier.h.result': { en: 'Result', ko: '결과' },
  'verifier.h.method': { en: 'How', ko: '방법' },
  'verifier.h.work': { en: 'Work', ko: '작업량' },
  'verifier.h.when': { en: 'When', ko: '시점' },
  'verifier.recheck_tag': { en: 're-measured', ko: '재측정' },
  'verifier.challenged_tag': { en: 'challenged after', ko: '이후 이의' },
  'verifier.work_cell': { en: '{run} of {available} questions · {seconds}s', ko: '질문 {available}개 중 {run}개 · {seconds}초' },
  'verifier.work_none': { en: 'not recorded', ko: '기록 없음' },
  'verifier.work_help': {
    en: 'How many of the knowledge’s questions this run actually asked, and how long it held the model. A four-question run and a forty-question one used to look identical.',
    ko: '이 실행이 실제로 물어본 질문 수와 모델을 붙잡고 있던 시간입니다. 예전에는 질문 4개짜리 실행과 40개짜리 실행이 똑같아 보였습니다.',
  },

  // The verification tab of a knowledge page
  'verifier.stale': { en: 'not counted', ko: '인정 안 됨' },
  'verifier.stale_help': {
    en: 'Written before the open challenge, so it is not an answer to it. It counts again when this verifier measures the knowledge after the challenge.',
    ko: '진행 중인 이의 제기보다 먼저 쓰인 기록이라 그 이의에 대한 답이 아닙니다. 이 검증자가 이의 제기 이후에 다시 측정하면 다시 인정됩니다.',
  },
  'verifier.stale_note': {
    en: 'Earlier verifications set aside: {n}. while this challenge is open: a record written before it answers nothing. It needs {quorum} fresh measurements to go back on sale.',
    ko: '이의 제기가 진행되는 동안 이전 검증 {n}건은 제외됩니다. 이의보다 먼저 쓰인 기록은 그 이의에 답한 것이 아니기 때문입니다. 다시 판매되려면 새로운 측정 {quorum}건이 필요합니다.',
  },
  'verifier.alone': {
    en: 'Verified on its own questions only',
    ko: '자기 질문에 대해서만 검증됨',
  },
  'verifier.alone_help': {
    en: 'This knowledge is built on {base}, but the verification measured only the questions it publishes itself — not whether {base} still answers its own. A verifier that holds {base} scores both.',
    ko: '이 지식은 {base} 위에 만들어졌지만, 검증은 이 지식이 스스로 공개한 질문만 측정했습니다. {base}가 자기 질문에 여전히 답하는지는 확인하지 않았습니다. {base}를 보유한 검증자가 검증하면 양쪽을 모두 채점합니다.',
  },
  'verifier.per_source': { en: 'its own {own} · still answers {rest}', ko: '자기 질문 {own} · {rest} 유지' },
  'verifier.resale': {
    en: '{n} of {total} rows in this file are identical to {base}’s',
    ko: '이 파일의 {total}개 행 가운데 {n}개가 {base}의 행과 동일합니다',
  },

  // What the verifiers said about a lesson that did not pass, on the teacher's own page (item 304)
  'teacher.rej.score': { en: 'did not pass: {score}', ko: '통과하지 못함: {score}' },
  'teacher.rej.asked': { en: 'Asked', ko: '물어본 질문' },
  'teacher.rej.expected': { en: 'Your answer', ko: '내가 가르친 답' },
  'teacher.rej.answered': { en: 'The model said', ko: '모델이 답한 내용' },
  'teacher.rej.empty': { en: '(nothing)', ko: '(아무 답도 하지 않음)' },
  'teacher.rej.no_questions': {
    en: '{who} did not record which question failed — the score is all it published.',
    ko: '{who}은(는) 어떤 질문에서 실패했는지 기록하지 않았습니다. 공개한 것은 점수뿐입니다.',
  },
  'teacher.rej.again': { en: 'Open this lesson and train it again', ko: '이 레슨을 열어서 다시 학습하기' },
  'teacher.rej.permanent': {
    en: 'This result stays on the public record. Training it again publishes a separate knowledge — it does not replace or remove this one.',
    ko: '이 결과는 공개 기록에 그대로 남습니다. 다시 학습하면 별도의 지식으로 공개되며, 이 기록을 대체하거나 지우지 않습니다.',
  },
  'teacher.item.last_error': { en: 'Last error: {error}', ko: '마지막 오류: {error}' },
  'teacher.item.nudge': { en: 'Ask the node to retry', ko: '노드에 재시도 요청' },
  'teacher.item.nudge_done': { en: 'asked — the transfer is now {status}', ko: '요청함 — 현재 전송 상태: {status}' },
  'teacher.item.nudge_wait': { en: 'already asked — try again in about {minutes} min', ko: '이미 요청했습니다. 약 {minutes}분 뒤에 다시 시도하세요' },

  // The base rate behind the "any node can challenge this" sentence (item 338)
  'verifier.base_rate': {
    en: 'On the record this node reads: {attestations} verifications, {failed} failed, {challenges} challenges ({upheld} upheld).',
    ko: '이 노드가 읽는 기록 기준: 검증 {attestations}건, 실패 {failed}건, 이의 제기 {challenges}건(인정 {upheld}건).',
  },
  'verifier.base_rate_zero': {
    en: 'On the record this node reads: {attestations} verifications, and no verification has ever failed or been challenged. Read the tick with that in mind.',
    ko: '이 노드가 읽는 기록 기준: 검증 {attestations}건이며, 실패하거나 이의가 제기된 검증은 한 번도 없었습니다. 이 점을 감안해서 표시를 읽으십시오.',
  },
};
