/**
 * Which chain the money on this screen lives on, and one sentence saying so (item 356).
 *
 * `price.ain_note` was a fixed string — "AIN = AI Network token (this demo runs a local dev chain)" — printed
 * under every AIN price, which is a lie on a node attached to anything but the demo chain and was missing from the
 * one number that matters most: the operator's own wallet total, where it lived in a `title=` attribute nobody can
 * hover on a phone. The kind is read off the provider the node reports, in one place, so every AIN figure in the
 * product carries the same label and the same caveat.
 *
 * `unknown` is deliberate: a node that does not say which chain it is attached to gets the plain token sentence and
 * no claim about value, rather than a guess.
 */
import { useInfoQuery } from '@/api/api';
import { useT } from '@/i18n';

export type NetworkKind = 'credit' | 'local_chain' | 'testnet' | 'mainnet' | 'unknown';

/** The same rule the wallet has used since item 356 landed on /account — now the only copy of it. */
export function networkKindOf(ledger?: { kind?: string; provider?: string | null }): NetworkKind {
  if (!ledger || ledger.kind !== 'ain') return ledger?.kind === 'ain' ? 'unknown' : 'credit';
  const provider = ledger.provider ?? '';
  if (!provider) return 'unknown';
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|\.local(:|\/|$)/.test(provider)) return 'local_chain';
  if (/test/i.test(provider)) return 'testnet';
  return 'mainnet';
}

export function useNetworkKind(): { kind: NetworkKind; note: (currency?: string | null) => string } {
  const { t } = useT();
  const { data: info } = useInfoQuery();
  const kind = networkKindOf(info?.ledger);
  /** The note that belongs under an amount in `currency` — empty for a currency that needs no explanation. */
  const note = (currency?: string | null): string => {
    if (currency === 'CREDIT') return t('price.credit_note');
    if (currency !== 'AIN') return '';
    return t(`price.ain_note.${kind === 'credit' ? 'unknown' : kind}`);
  };
  return { kind, note };
}
