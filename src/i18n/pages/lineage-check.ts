/**
 * Item 182 — the one thing the "Built on" block could not say: that the base was never checked.
 *
 * `parent_check` entries are rendered only when `total > 0`, and a node that simulates its checks reports 0 — so on
 * every demo node the base was named and nothing was ever said about whether it still works, under a heading that
 * otherwise reads as a measurement. New keys only; no shared dictionary is touched.
 */
import type { Dict } from '../index';

export const LINEAGE_CHECK: Dict = {
  'teach.res.parent_unchecked': {
    en: 'Not checked against {name} on this node — nothing measured whether it still answers its own questions with this lesson on top.',
    ko: '이 노드에서는 {name}에 대해 확인하지 않았습니다. 이 레슨을 올린 상태에서 {name}이(가) 자기 질문에 여전히 답하는지 아무것도 측정하지 않았습니다.',
  },
  'teach.res.parent_simulated': {
    en: 'Not measured against {name}: this node simulates its checks, so nothing was asked of a live model.',
    ko: '{name}에 대해 실제로 측정하지 않았습니다. 이 노드는 검사를 시뮬레이션하므로 실제 모델에 아무것도 묻지 않았습니다.',
  },
};
