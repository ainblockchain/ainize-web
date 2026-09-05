import type { Dict } from '../index';

/**
 * The knowledge-track page (`/tracks/<name>`) and the two columns the `/network` track table gained with it —
 * finding 268. Everything else this page shows already had a word: statuses come from `status.*`, prices and models
 * from `common.*`, and the explanation of what a track is from `detail.net.tracks_note`, so the one sentence a
 * reader meets in two places stays one sentence.
 */
export const tracks: Dict = {
  'track.title': { ko: '지식 묶음', en: 'Knowledge track' },
  'track.no_description': { ko: '설명이 없습니다.', en: 'No description.' },

  /**
   * Item 361 — `subscribers` is live state: a node that leaves simply disappears from it, so the person deciding
   * whether to keep baking every morning saw a number that only ever shrank, with no history and no earnings. The
   * `subscribe` records on the public record carry the action and the time, and each member's own sales are counted
   * on its catalogue entry — so both are read from what is already there.
   */
  'track.churn': { ko: '지금까지 구독 {joined}건 · 해지 {left}건', en: '{joined} ever joined · {left} left' },
  'track.churn.joined': { ko: '{node} 구독 ({ago})', en: '{node} subscribed {ago}' },
  'track.churn.left': { ko: '{node} 해지 ({ago})', en: '{node} unsubscribed {ago}' },
  'track.sales': { ko: '이 묶음의 판매', en: 'Sales in this track' },
  'track.sales_none': { ko: '아직 판매 없음', en: 'no sales yet' },
  'track.sales_value': { ko: '{n}건 · {total}', en: '{n} sale(s) · {total}' },
  'track.sales_cell': { ko: '{n}건 · {total}', en: '{n} · {total}' },
  'track.h.sales': { ko: '판매', en: 'Sales' },
  'track.h.sales_help': { ko: '이 버전이 팔린 횟수와 금액입니다. 매일 새로 굽는 묶음이라면 어느 날 것이 팔리는지 여기서 보입니다.', en: 'How many times this version sold and for how much — on a track that bakes daily, which day sells.' },
  'track.owner': { ko: '만든 노드', en: 'Made by' },
  'track.situation': { ko: '상황(조건)', en: 'Situation' },
  'track.situation_none': { ko: '조건 없음', en: 'no conditions' },
  'track.members': { ko: '들어 있는 지식', en: 'Knowledge inside' },
  'track.members_value': { ko: '전체 {total}개 · 지금 받아 가는 것 {current}개', en: '{total} in total · {current} a subscriber loads today' },
  'track.updated': { ko: '가장 최근 버전', en: 'Freshest version' },
  'track.updated_value': { ko: '{ago} 등록', en: 'registered {ago}' },
  // The chip beside the track name when THIS node is one of the subscribers below: a state, not an action, so it
  // reads as a label rather than a button the visitor could press.
  'track.subscribed': { ko: '이 노드가 구독 중', en: 'this node subscribes' },
  'track.subscribers': { ko: '구독 중인 노드', en: 'Subscribed nodes' },
  'track.subscribers_none': { ko: '아직 없습니다', en: 'none yet' },
  'track.created': { ko: '묶음이 생긴 때', en: 'Track created' },

  'track.members_title': { ko: '이 묶음에 든 지식', en: 'What is in this track' },
  'track.members_note': { ko: '구독하면 "현재 버전"으로 표시된 것만 사서 모델에 넣습니다. 다른 버전이 대신한 지난 버전은 기록으로 남아 여기 함께 보이지만, 다시 사거나 넣지 않습니다.', en: 'A subscriber buys and loads only the rows marked “current”. A version another member has replaced stays here because the record keeps it, but it is neither bought again nor loaded.' },
  'track.members_empty': { ko: '아직 이 묶음에 넣은 지식이 없습니다.', en: 'Nothing has been added to this track yet.' },
  'track.h.knowledge': { ko: '지식', en: 'Knowledge' },
  'track.h.status': { ko: '상태', en: 'Status' },
  'track.h.registered': { ko: '등록', en: 'Registered' },
  'track.current': { ko: '현재 버전', en: 'current' },
  'track.unknown_member': { ko: '이 노드에 없음', en: 'not on this node' },

  'track.follow_title': { ko: '이 묶음 구독하기', en: 'Follow this track' },
  'track.follow_body': { ko: '구독은 내가 운영하는 노드에서 하는 일입니다. 아직 없는 현재 버전을 사서 모델에 넣고, 묶음이 바뀌면 그때마다 다시 맞춰 줍니다. 이 화면에 버튼이 없는 것은 그 일이 노드 잔액에서 실제로 돈을 쓰기 때문입니다.', en: 'Subscribing is something you do on your own node: it buys the current versions you do not already hold, loads them into your model, and does it again when the track moves on. There is no button here because it spends your node’s balance.' },
  'track.follow_record': { ko: '구독하면 "이 노드가 이 묶음을 서비스한다"는 사실이 공개 기록에 영구히 남고, 어느 노드나 읽을 수 있습니다. 지식을 하나씩 손으로 넣을 때(`ainize use <id>`)는 그런 기록이 남지 않습니다.', en: 'Subscribing writes a permanent public record — “this node serves this track” — that any peer can read. Loading a knowledge by hand (`ainize use <id>`) leaves no such record.' },
  'track.follow_cost': { ko: '드는 돈은 아직 가지고 있지 않은 현재 버전들의 가격을 더한 만큼이고, 노드 잔액에서 나갑니다. 위 표의 가격을 먼저 확인하세요.', en: 'What it costs is the price of each current version you do not already own, taken from your node’s balance. Read the prices in the table above first.' },

  'track.back': { ko: '전체 지식 묶음 보기', en: 'All knowledge tracks' },
  'track.notfound.title': { ko: '그런 지식 묶음이 없습니다', en: 'No such track' },
  'track.notfound.body': { ko: '이 노드는 "{name}" 묶음을 모릅니다. 다른 노드는 알고 있을 수 있습니다.', en: 'This node does not know a track called “{name}”. Another node might.' },

  // the /network table (finding 268: it showed neither what a subscriber gets today nor how fresh it is)
  'track.net.h.current': { ko: '현재 버전', en: 'Current' },
  'track.net.h.updated': { ko: '최근 등록', en: 'Updated' },
  'track.net.current_title': { ko: '지금 이 묶음을 구독하면 받아 가는 지식입니다.', en: 'What a node subscribing to this track loads today.' },
  'track.net.updated_title': { ko: '현재 버전 가운데 가장 최근에 등록된 것의 등록 시점입니다.', en: 'When the newest of those current versions was registered.' },
  'track.net.none': { ko: '없음', en: 'none' },
};
