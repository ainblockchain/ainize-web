/**
 * What `/api/throughput` says, read defensively — and the arithmetic the billing page needs around it.
 *
 * The billing page (`/billing`, `BillingPage.tsx`) is one sentence: "now N tok/s → deposit X → M tok/s". The node
 * does the math where the numbers live (ainize-node `src/throughput-routes.ts`; design:
 * ainize-node `docs/superpowers/specs/2026-09-26-throughput-billing-design.md`). What this module owns is the part
 * the node cannot: reading its answer when the two were released on different days, and turning "100 sAIN" into
 * the exact bytes a wallet signs.
 *
 * READING THE ANSWER. Every field is optional here even though today's node always sends it, for the same reason
 * `models.ts` defaults `available` to false: a node from before a field existed must not have its silence drawn as
 * a number. A missing rate is not 0 tok/s, and a missing `deposits` block is not "deposits are on".
 *
 *   • A route the node does not have at all (an older node) answers 404 as an Express HTML page — RTK Query then
 *     reports `PARSING_ERROR` with `originalStatus: 404`. That is "this node is too old", not "no such model".
 *   • A model the node does not serve answers 404 as JSON with `code: model_not_served`. That is the other one.
 *   • Anything else that fails is the node not answering, and is said as that.
 *
 * WHY THE CALLDATA IS BUILT BY HAND. An ERC-20 `transfer(address,uint256)` is a 4-byte selector and two 32-byte
 * words — 68 bytes with no dynamic parts. A contract library to produce that would be the largest dependency on
 * the page, and the encoding is pinned by a known vector in `test/billing-throughput.test.ts` so a slip in the
 * padding shows up there, not as tokens sent to the wrong place.
 *
 * Pure: no React, no fetch, no wallet. The wallet half is `src/lib/billingWalletDeposit.ts`.
 */

/** Which token a deposit is made in. sAIN is the staking vault's share (1 sAIN = weight 1); AIN is converted at the vault's rate. */
export type BillingDepositToken = 'sAIN' | 'AIN';

/** One chain + token the node watches for incoming transfers. */
export interface BillingDepositChain {
  /** the node's name for it (`base`, `ethereum`, `base-sepolia`, …) */
  chain: string;
  /** EIP-155 id, or null when the node could not name one — such a chain cannot be sent to from a wallet */
  chainId: number | null;
  /** the token contract to call `transfer` on */
  token: string;
  symbol: BillingDepositToken;
  decimals: number;
  /** blocks the node waits for before crediting */
  confirmations: number;
}

export interface BillingThroughputQuote {
  token: BillingDepositToken;
  amount: string;
  /** what the amount adds, in sAIN — null when the AIN→sAIN rate could not be read */
  sain: number | null;
  /** expected tok/s after the deposit, at this moment's contention */
  expectedTokS: number | null;
  /** expected tok/s after the deposit when somebody else is asking too — the case a deposit is for */
  busyExpectedTokS: number | null;
  /** after ÷ now; null when "now" is 0 */
  multiplier: number | null;
  /** the node's reason when it could not quote (today: the AIN rate is unreadable) */
  error: string | null;
}

export interface BillingThroughput {
  model: string;
  rate: {
    /** the model's tok/s — measured, or the node's fallback constant */
    tokS: number;
    /** false → `tokS` is the fallback estimate, and the page says "estimated" */
    measured: boolean;
    /** how many calls the measurement is over */
    samples: number;
  };
  freeTier: {
    expectedTokS: number;
    /** what the free tier gets while a depositor is asking — next to nothing, and the page says so */
    busyExpectedTokS: number | null;
    /** nobody else is asking right now */
    idle: boolean;
  };
  /** the signed-in wallet's numbers; null for a visitor without a wallet session (or a Google-only one) */
  /** `busyExpectedTokS`: this caller when one other 1-sAIN caller is asking — what the deposit card compares. */
  you: { address: string; depositedSain: number; expectedTokS: number; busyExpectedTokS: number | null; idle: boolean } | null;
  quote: BillingThroughputQuote | null;
  deposits:
    | { enabled: false }
    | { enabled: true; address: string; ainPerSain: number | null; chains: BillingDepositChain[] };
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null);
const token = (v: unknown): BillingDepositToken | null => (v === 'sAIN' || v === 'AIN' ? v : null);

/**
 * Read `GET /api/throughput`. Null for anything that has no model and no rate — the page then shows its
 * "could not read" state instead of numbers made of defaults.
 */
export function parseBillingThroughputResponse(raw: unknown): BillingThroughput | null {
  const r = obj(raw);
  if (!r) return null;
  const model = str(r.model);
  const rate = obj(r.rate);
  const tokS = num(rate?.tok_s);
  if (!model || !rate || tokS === null) return null;

  const free = obj(r.free_tier);
  const youRaw = obj(r.you);
  const youAddress = str(youRaw?.address);
  const youTok = num(youRaw?.expected_tok_s);
  const quoteRaw = obj(r.quote);
  const quoteToken = token(quoteRaw?.token);

  return {
    model,
    rate: { tokS, measured: rate.measured === true, samples: Math.max(0, num(rate.samples) ?? 0) },
    freeTier: {
      // The free tier is the whole model on an idle node; an answer without the field falls back to that, and
      // `idle` falls back to false so the page does not claim a quiet node it was not told about.
      expectedTokS: num(free?.expected_tok_s) ?? tokS,
      busyExpectedTokS: num(free?.busy_expected_tok_s),
      idle: free?.idle === true,
    },
    you: youRaw && youAddress && youTok !== null ? {
      address: youAddress,
      depositedSain: Math.max(0, num(youRaw.deposited_sain) ?? 0),
      expectedTokS: youTok,
      busyExpectedTokS: num(youRaw.busy_expected_tok_s),
      idle: youRaw.idle === true,
    } : null,
    quote: quoteRaw && quoteToken ? {
      token: quoteToken,
      amount: str(quoteRaw.amount) ?? '',
      sain: num(quoteRaw.sain),
      expectedTokS: num(quoteRaw.expected_tok_s),
      busyExpectedTokS: num(quoteRaw.busy_expected_tok_s),
      multiplier: num(quoteRaw.multiplier),
      error: str(quoteRaw.error),
    } : null,
    deposits: parseBillingDeposits(r.deposits),
  };
}

function parseBillingDeposits(raw: unknown): BillingThroughput['deposits'] {
  const d = obj(raw);
  const address = str(d?.address);
  if (!d || d.enabled !== true || !address) return { enabled: false };
  const chains: BillingDepositChain[] = [];
  for (const entry of Array.isArray(d.chains) ? d.chains : []) {
    const c = obj(entry);
    const chain = str(c?.chain);
    const tokenAddress = str(c?.token);
    const symbol = token(c?.symbol);
    if (!c || !chain || !tokenAddress || !symbol) continue;
    const chainId = num(c.chain_id);
    chains.push({
      chain, token: tokenAddress, symbol,
      chainId: chainId !== null && Number.isInteger(chainId) && chainId > 0 ? chainId : null,
      decimals: num(c.decimals) ?? 18,
      confirmations: Math.max(0, num(c.confirmations) ?? 12),
    });
  }
  return { enabled: true, address, ainPerSain: num(d.ain_per_sain), chains };
}

/** What the page can say about the node's answer, beyond whether it parsed. */
export type BillingThroughputFetchState = 'ok' | 'not_served' | 'outdated' | 'offline';

/**
 * Tell "this node does not serve that model" from "this node is older than the route" from "the node is down".
 *
 * `error` is an RTK Query error: a JSON 404 keeps `status: 404` and the body in `data`; an HTML 404 (Express's
 * default for a route it has never heard of) becomes `status: 'PARSING_ERROR'` with the code in `originalStatus`.
 */
export function billingThroughputFetchState(
  error: { status?: number | string; originalStatus?: number; data?: unknown } | undefined | null,
): BillingThroughputFetchState {
  if (!error) return 'ok';
  const code = typeof error.status === 'number' ? error.status : error.originalStatus;
  if (code !== 404) return 'offline';
  const errCode = obj(obj(error.data)?.error)?.code;
  return errCode === 'model_not_served' ? 'not_served' : 'outdated';
}

/** `GET /api/throughput/deposits/:txHash` — has the transfer been credited to the signed-in wallet yet. */
export interface BillingDepositStatus { credited: boolean; sain: number | null }

export function parseBillingDepositStatus(raw: unknown): BillingDepositStatus {
  const r = obj(raw);
  return { credited: r?.credited === true, sain: num(r?.sain) };
}

/**
 * "12.5" → 12.5 × 10^decimals as a bigint. Null for anything that is not a plain non-negative decimal.
 *
 * The same grammar the node accepts for `amount` (`throughputParseUnits`), so an amount the page will send is an
 * amount the node will quote — and never a float: 0.1 + 0.2 is not a thing a wallet should be asked to sign.
 * Digits past `decimals` are refused rather than rounded, because rounding a transfer is changing it.
 */
export function billingAmountToUnits(amount: string, decimals = 18): bigint | null {
  const m = /^(\d{1,15})(?:\.(\d+))?$/.exec(amount.trim());
  if (!m) return null;
  const fracRaw = m[2] ?? '';
  if (fracRaw.length > decimals) return null;
  const frac = fracRaw.padEnd(decimals, '0');
  return BigInt(m[1]!) * 10n ** BigInt(decimals) + BigInt(frac || '0');
}

/** `0x`-prefixed 20-byte hex address, any case. */
export function billingIsHexAddress(value: unknown): value is string {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
}

/** Two addresses are the same account whatever their checksum casing. */
export function billingSameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

/** `transfer(address,uint256)` — the first four bytes of its keccak-256. */
export const BILLING_ERC20_TRANSFER_SELECTOR = '0xa9059cbb';
const UINT256_MAX = (1n << 256n) - 1n;

/**
 * Calldata for `transfer(to, units)`: selector + the address left-padded to 32 bytes + the amount as a 32-byte
 * big-endian word. Lowercase hex, as every wallet accepts. Throws on an address that is not 20 bytes or an amount
 * outside uint256 — a wrong byte here moves real tokens, so there is no "best effort".
 */
export function billingErc20TransferCalldata(to: string, units: bigint): string {
  if (!billingIsHexAddress(to)) throw new Error(`not an address: ${to}`);
  if (units < 0n || units > UINT256_MAX) throw new Error('amount out of range');
  const addressWord = to.slice(2).toLowerCase().padStart(64, '0');
  const amountWord = units.toString(16).padStart(64, '0');
  return `${BILLING_ERC20_TRANSFER_SELECTOR}${addressWord}${amountWord}`;
}

/** EIP-155 chain id as the hex a wallet's `wallet_switchEthereumChain` wants: 8453 → `0x2105`. */
export function billingChainIdHex(chainId: number): string {
  if (!Number.isInteger(chainId) || chainId <= 0) throw new Error(`not a chain id: ${chainId}`);
  return `0x${chainId.toString(16)}`;
}

/** A human name for the chains the node knows by number; the node's own name otherwise. */
export function billingChainLabel(chain: BillingDepositChain): string {
  if (chain.chainId === 8453) return 'Base';
  if (chain.chainId === 1) return 'Ethereum';
  return chain.chain;
}

/** Where a person can watch their transaction. Null for a chain this page has no explorer for. */
export function billingExplorerTxUrl(chainId: number | null, txHash: string): string | null {
  if (chainId === 8453) return `https://basescan.org/tx/${txHash}`;
  if (chainId === 1) return `https://etherscan.io/tx/${txHash}`;
  return null;
}

/** Seconds per block, for "≈ how long until credited". Base is 2 s, Ethereum 12 s. */
const BILLING_BLOCK_SECONDS: Record<number, number> = { 8453: 2, 1: 12 };

/** Roughly how long the node's confirmation wait is, in seconds — null for a chain whose block time is not known here. */
export function billingConfirmationSeconds(chain: BillingDepositChain): number | null {
  const perBlock = chain.chainId !== null ? BILLING_BLOCK_SECONDS[chain.chainId] : undefined;
  return perBlock !== undefined ? chain.confirmations * perBlock : null;
}

/**
 * The chain to send `symbol` on. The first one the node lists with that symbol AND a chain id — a chain without an
 * id cannot be selected in a wallet, so it is only offered as the copyable address, never as a button.
 */
export function billingPickDepositChain(chains: BillingDepositChain[], symbol: BillingDepositToken): BillingDepositChain | null {
  return chains.find((c) => c.symbol === symbol && c.chainId !== null) ?? chains.find((c) => c.symbol === symbol) ?? null;
}

/**
 * What `wallet_addEthereumChain` needs for a chain the wallet has never seen (error 4902 on switch). Only Base is
 * here: Ethereum mainnet is built into every wallet, and a chain this page does not know it will not describe.
 */
export const BILLING_ADDABLE_CHAINS: Record<number, {
  chainId: string; chainName: string; rpcUrls: string[]; blockExplorerUrls: string[];
  nativeCurrency: { name: string; symbol: string; decimals: number };
}> = {
  8453: {
    chainId: '0x2105', chainName: 'Base', rpcUrls: ['https://mainnet.base.org'], blockExplorerUrls: ['https://basescan.org'],
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
};

/** The preset amounts under the input. */
export const BILLING_AMOUNT_PRESETS = ['10', '100', '1000'] as const;

/** tok/s for display: whole numbers above 10, one decimal below, "≈0" for what rounds to nothing. */
export function billingFormatTokS(value: number | null): string {
  if (value === null) return '—';
  if (value > 0 && value < 0.05) return '≈0';
  return value >= 10 ? String(Math.round(value)) : (Math.round(value * 10) / 10).toString();
}

/** A confirmation wait for display: "≈1 min" on Base (30 blocks × 2 s), "≈45 s", "≈3 min". */
export function billingFormatWaitSeconds(seconds: number): string {
  return seconds < 90 && seconds % 60 !== 0 ? `≈${Math.max(1, Math.round(seconds))} s` : `≈${Math.max(1, Math.round(seconds / 60))} min`;
}
