import { useInfoQuery } from '@/api/api';
import { useAuth } from '@/auth/AuthContext';
import { useT } from '@/i18n';
import { networkKindOf, type NetworkKind } from '@/lib/networkKind';
export { networkKindOf, type NetworkKind } from '@/lib/networkKind';

export function useNetworkKind(): { kind: NetworkKind; note: (currency?: string | null) => string } {
  const { t } = useT(), auth = useAuth();
  const query = useInfoQuery({ identity: auth.cacheIdentity });
  const info = !auth.loading && !query.isError && auth.address && typeof query.currentData?.node?.address === 'string'
    && query.currentData.node.address.toLowerCase() === auth.address.toLowerCase() ? query.currentData : undefined;
  const kind = networkKindOf(info?.ledger, info?.node?.chain_id);
  const note = (currency?: string | null): string => {
    if (currency === 'CREDIT') return t('price.credit_note');
    if (currency !== 'AIN') return '';
    return t(`price.ain_note.${kind === 'credit' ? 'unknown' : kind}`);
  };
  return { kind, note };
}
