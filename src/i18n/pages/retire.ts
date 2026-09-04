/**
 * A knowledge its author took off sale (item 148). The takedown shows up on three surfaces — the status chip
 * anywhere, the public knowledge page's buy area, and the operator's manage page — so its strings live in their own
 * page dictionary rather than in any one page's file (see ./index.ts).
 */
import type { Dict } from '../index';

export const RETIRE: Dict = {
  'status.RETIRED': { ko: '판매 중단됨', en: 'Off sale' },
  'status.RETIRED_help': { ko: '만든 사람이 이 지식의 판매를 멈췄습니다. 공개 기록은 그대로 남아 있고, 이미 산 사람은 받은 파일을 계속 쓸 수 있습니다.', en: 'The publisher stopped selling this knowledge. The public record stays as it is, and everyone who already bought it keeps the file they paid for.' },
  'detail.buy.retired': { ko: '만든 사람이 이 지식을 판매 중단했습니다 — 더 이상 살 수 없습니다. 이미 산 사람은 계속 쓸 수 있고, 검증 기록도 그대로 남습니다.', en: 'The publisher took this knowledge off sale — it cannot be bought any more. Everyone who already bought it keeps it, and its verification record stays on the ledger.' },
  'detail.buy.retired.reason': { ko: '만든 사람의 설명: “{reason}”', en: 'The publisher\'s reason: “{reason}”' },
};
