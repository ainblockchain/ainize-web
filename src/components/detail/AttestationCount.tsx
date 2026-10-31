import type { Attestation, CatalogEntry } from '@/api/types';
import { useT } from '@/i18n';
import { verificationContribution, contributesToQuorum } from '@/lib/verificationView';

export function AttestationCount({ entry, attestation }: { entry: CatalogEntry; attestation: Attestation }) {
  const { t } = useT();
  const kind = verificationContribution(entry, attestation);
  return <span data-testid="attestation-count" data-kind={kind} style={{ color: contributesToQuorum(kind) ? undefined : '#8a4b00' }}>{t(`detail.ver.contribution.${kind}`)}</span>;
}
