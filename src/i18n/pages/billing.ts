/**
 * The billing page (`/billing`) — "now N tok/s → deposit X → M tok/s" — and the links that lead to it.
 *
 * The honest-labelling rule from the design (ainize-node `docs/superpowers/specs/2026-09-26-throughput-billing-design.md`)
 * applies to every string here: the free tier is the whole model when nobody else is asking and next to nothing
 * when a depositor is, and a deposit speeds up API-key calls (`/v1`), not the free playground. No sentence below
 * may average those into a number that is true at no moment.
 */
import type { Dict } from '../index';

export const billing: Dict = {
  'billing.title': { ko: '속도 올리기', en: 'Speed up' },
  'billing.lede': {
    ko: '지금 이 모델에서 기대할 수 있는 속도와, sAIN이나 AIN을 예치하면 얼마가 되는지를 보여줍니다. 예치는 보낸 주소로 적립되고 그 주소의 가중치가 됩니다.',
    en: 'What speed you can expect from this model now, and what depositing sAIN or AIN would raise it to. A deposit is credited to the address that sends it and becomes that address’s weight.',
  },
  'billing.model': { ko: '모델', en: 'Model' },
  'billing.no_models': { ko: '이 노드가 서빙하는 대화 모델이 없습니다.', en: 'This node serves no chat model.' },

  'billing.state.outdated': {
    ko: '이 노드는 속도 조회(/api/throughput)보다 오래된 버전입니다. 노드를 업데이트하면 이 페이지가 동작합니다.',
    en: 'This node is older than the throughput route (/api/throughput). The page works once the node is updated.',
  },
  'billing.state.not_served': { ko: '이 노드는 {model} 대화 모델을 서빙하지 않습니다.', en: 'This node does not serve a chat model called {model}.' },
  'billing.state.offline': { ko: '노드가 지금 응답하지 않습니다.', en: 'The node is not answering right now.' },

  'billing.now.title': { ko: '지금', en: 'Now' },
  'billing.now.you': { ko: '내 API 호출', en: 'Your API calls' },
  'billing.now.free': { ko: '무료 티어', en: 'Free tier' },
  'billing.now.deposited': { ko: '예치한 양: {n} sAIN', en: 'Deposited: {n} sAIN' },
  'billing.now.idle': { ko: '한가함 — 모델 전체를 씁니다', en: 'idle — you get the whole model' },
  'billing.now.busy': { ko: '붐빔 — 가중치대로 나눠 씁니다', en: 'busy — shared by weight' },
  'billing.now.rate_measured': { ko: '모델 속도 {r} tok/s — 최근 호출 {n}건으로 측정', en: 'Model speed {r} tok/s — measured over {n} calls' },
  'billing.now.rate_estimated': { ko: '모델 속도 {r} tok/s — 아직 측정 전이라 추정치', en: 'Model speed {r} tok/s — estimated, nothing measured yet' },
  'billing.now.free_busy': {
    ko: '예치한 사람이 같이 요청하는 동안 무료 티어는 {n} tok/s — 사실상 멈춥니다.',
    en: 'While someone with a deposit is asking too, the free tier gets {n} tok/s — next to nothing.',
  },
  'billing.now.scope': {
    ko: '예치는 API 키로 하는 호출(/v1)에 적용됩니다. 무료 플레이그라운드는 계속 무료 티어입니다.',
    en: 'Deposits apply to calls made with an API key (/v1), not to the free playground.',
  },
  'billing.now.signin': { ko: '지갑으로 로그인하면 내 숫자를 볼 수 있습니다.', en: 'Sign in with a wallet to see your own numbers.' },
  'billing.now.signin_link': { ko: '지갑으로 로그인', en: 'Sign in with a wallet' },

  'billing.deposit.title': { ko: '예치', en: 'Deposit' },
  'billing.deposit.disabled': {
    ko: '이 노드는 처리량을 팔지 않습니다 — 예치 주소가 설정되어 있지 않고, 요청은 도착 순서대로 처리됩니다.',
    en: 'This node does not sell throughput — it has no deposit address, and requests are served in arrival order.',
  },
  'billing.deposit.amount': { ko: '수량', en: 'Amount' },
  'billing.deposit.bad_amount': { ko: '10이나 2.5처럼 숫자로 적어주세요.', en: 'Enter a number, e.g. 10 or 2.5.' },
  'billing.deposit.busy_compare': { ko: '붐빌 때 {before} → {after} tok/s', en: 'When busy: {before} → {after} tok/s' },
  'billing.deposit.multiplier': { ko: '(×{k})', en: '(×{k})' },
  'billing.deposit.from_nothing': { ko: '(예치가 없으면 붐빌 때 거의 0)', en: '(with no deposit: next to nothing when busy)' },
  'billing.deposit.now_idle': { ko: '지금처럼 한가하면 누구나 모델 전체({m} tok/s)를 씁니다 — 예치는 붐빌 때를 위한 것입니다.', en: 'While the node is idle everyone gets the whole model ({m} tok/s) — a deposit is for when it is busy.' },
  'billing.deposit.now_busy': { ko: '지금(붐비는 중) 예치하면 {m} tok/s', en: 'Right now (busy) this deposit gives {m} tok/s' },
  'billing.deposit.sain_equiv': { ko: '≈ {n} sAIN', en: '≈ {n} sAIN' },
  'billing.deposit.ain_rate': { ko: '1 sAIN = {r} AIN (스테이킹 볼트 환율, 5분마다 갱신)', en: '1 sAIN = {r} AIN (the staking vault’s rate, refreshed every 5 min)' },
  'billing.deposit.quote_error': { ko: '견적을 낼 수 없습니다: {why}', en: 'No quote right now: {why}' },
  'billing.deposit.no_chain': { ko: '이 노드는 {token} 예치를 받지 않습니다.', en: 'This node does not take {token} deposits.' },
  'billing.deposit.button': { ko: '지갑으로 예치', en: 'Deposit with wallet' },
  'billing.deposit.button_named': { ko: '{name}(으)로 예치', en: 'Deposit with {name}' },
  'billing.deposit.sending': { ko: '지갑에서 확인해 주세요…', en: 'Confirm in your wallet…' },
  'billing.deposit.need_signin': {
    ko: '먼저 지갑으로 로그인하세요. 예치는 보낸 주소로 적립되므로, 이 사이트에 로그인한 주소와 보내는 주소가 같아야 합니다.',
    en: 'Sign in with your wallet first. A deposit is credited to the address that sends it, so the sending address must be the one signed in here.',
  },
  'billing.deposit.from_rule': {
    ko: '{address} 에서 보내세요. 다른 주소에서 보내면 그 주소로 적립됩니다.',
    en: 'Send from {address}. A transfer from any other address is credited to that address instead.',
  },
  'billing.deposit.from_rule_anon': {
    ko: 'API 키를 가진 지갑 주소에서 보내세요. 예치는 보낸 주소로 적립됩니다.',
    en: 'Send from the wallet address your API key belongs to. A deposit is credited to the address that sends it.',
  },
  'billing.deposit.sent': { ko: '보냈습니다:', en: 'Sent:' },
  'billing.deposit.waiting': {
    ko: '블록 확인 {n}개를 기다립니다 ({wait}). 10초마다 확인합니다…',
    en: 'Waiting for {n} confirmations ({wait}). Checking every 10 s…',
  },
  'billing.deposit.waiting_unknown': { ko: '블록 확인 {n}개를 기다립니다. 10초마다 확인합니다…', en: 'Waiting for {n} confirmations. Checking every 10 s…' },
  'billing.deposit.credited': { ko: '{n} sAIN 적립됨 — 위의 숫자가 갱신되었습니다.', en: 'Credited {n} sAIN — the numbers above are updated.' },
  'billing.deposit.credited_plain': { ko: '적립됨 — 위의 숫자가 갱신되었습니다.', en: 'Credited — the numbers above are updated.' },

  'billing.manual.title': { ko: '직접 보내기', en: 'Send it yourself' },
  'billing.manual.no_wallet': {
    ko: '이 브라우저에 지갑이 없습니다. 아래 주소로 토큰을 직접 보내세요.',
    en: 'No wallet in this browser. Send the token to the address below yourself.',
  },
  'billing.manual.to': { ko: '받는 주소', en: 'Receiving address' },
  'billing.manual.chain': { ko: '체인', en: 'Chain' },
  'billing.manual.token': { ko: '토큰 컨트랙트', en: 'Token contract' },

  'billing.err.rejected': { ko: '지갑에서 취소했습니다.', en: 'Cancelled in the wallet.' },
  'billing.err.connect_failed': { ko: '지갑에 연결하지 못했습니다.', en: 'Could not connect to the wallet.' },
  'billing.err.account_mismatch': {
    ko: '지갑에 연결된 계정({wallet})이 로그인한 주소({subject})와 다릅니다. 예치는 보낸 주소로 적립되므로 보내지 않았습니다 — 지갑에서 계정을 바꾸고 다시 시도하세요.',
    en: 'The wallet’s connected account ({wallet}) is not the address signed in here ({subject}). A deposit is credited to the sending address, so nothing was sent — switch accounts in the wallet and try again.',
  },
  'billing.err.switch_failed': { ko: '지갑을 해당 체인으로 바꾸지 못했습니다.', en: 'Could not switch the wallet to that chain.' },
  'billing.err.wrong_chain': { ko: '지갑이 다른 체인에 있습니다. 보내지 않았습니다.', en: 'The wallet is on a different chain, so nothing was sent.' },
  'billing.err.send_failed': { ko: '트랜잭션을 보내지 못했습니다.', en: 'The transaction was not sent.' },
  'billing.err.bad_amount': { ko: '0보다 큰 수량을 적어주세요.', en: 'Enter an amount above 0.' },
  'billing.err.unknown_chain': { ko: '이 체인은 지갑으로 선택할 수 없습니다 — 직접 보내기를 이용하세요.', en: 'This chain cannot be selected in a wallet — use “Send it yourself”.' },
  'billing.err.status_failed': { ko: '적립 여부를 확인하지 못했습니다: {why}', en: 'Could not check whether it was credited: {why}' },

  // the ways in, from a model page (screens/models/modelSpeedHints.ts): where a deposit is true and felt
  'billing.fact.title': { ko: '속도', en: 'Speed' },
  'billing.fact.idle': { ko: '{tokS} tok/s · 한가함', en: '{tokS} tok/s · idle' },
  'billing.fact.busy': { ko: '{tokS} tok/s · 바쁨', en: '{tokS} tok/s · busy' },
  'billing.fact.estimated': { ko: '추정치', en: 'estimated' },
  'billing.fact.link_idle': { ko: '바쁠 때도 먼저 처리받기 →', en: 'Be served first when busy →' },
  'billing.fact.link_busy': { ko: '무료는 대기 중 — sAIN으로 먼저 처리받기 →', en: 'Free requests are waiting — be served first with sAIN →' },
  'billing.try.waiting': { ko: '유료 요청이 먼저 처리되는 중이라, 무료 요청은 그 뒤에서 기다립니다.', en: 'Paid requests are being served first, so free ones wait behind them.' },
  'billing.try.offer': { ko: '{amount} sAIN을 예치하면 바쁠 때도 {after} tok/s — 지금은 {now} tok/s', en: 'Deposit {amount} sAIN for {after} tok/s even when busy — {now} tok/s now' },
  'billing.try.after_idle': { ko: '무료 · 모델 속도 {tokS} tok/s · 한가해서 모델 전체를 썼습니다', en: 'Free · model speed {tokS} tok/s · idle, so you had the whole model' },
  'billing.try.after_busy': { ko: '무료 · 모델 속도 {tokS} tok/s · 바빠서 유료 요청 뒤에 처리됐습니다', en: 'Free · model speed {tokS} tok/s · busy, so it ran after paid requests' },
  'billing.key.offer': { ko: '이 키로 호출할 때 — 바쁠 때 {now} tok/s → {amount} sAIN 예치 시 {after} tok/s', en: 'Calls with this key — when busy: {now} tok/s → {after} tok/s with {amount} sAIN' },
  'billing.cta.deposit': { ko: '예치하기 →', en: 'Deposit →' },
};
