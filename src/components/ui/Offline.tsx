/**
 * The one shape a PUBLIC page takes when the node behind it does not answer (finding 77).
 *
 * Before this, an unreachable node was rendered three different ways and none of them said anything was wrong:
 * `/ledger` drew its whole frame with em-dashes, "Integrity checking…" and "No records yet." — on a public record
 * page an outage rendered as "no records" is the worst possible lie — and `/network` sat on a spinner that never
 * resolved. Both now hide the frames they cannot fill and say the same sentence in the same place, above one button
 * that tries again.
 *
 * Deliberately the twin of the console's `QueryError` (components/operator/common.tsx): same Alert, same small
 * secondary button, different words. An operator is being reassured that their own knowledge has not gone missing;
 * a visitor is being told that this node — not the marketplace — is unreachable from their browser right now.
 */
import { errorMessage } from '@/api/api';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import styled from 'styled-components';

const Row = styled.div`
  display: flex; flex-wrap: wrap; align-items: center; gap: 12px;
`;
const Text = styled.span`
  flex: 1 1 240px; min-width: 0;
  strong { display: block; }
`;

export function Offline({ error, onRetry, retrying, what }: { error?: unknown; onRetry: () => void; retrying?: boolean; what: string }) {
  const { t } = useT();
  const status = (error as { status?: number | string } | null | undefined)?.status;
  // `errorMessage` already ends in "(502)" for a bare HTTP failure, so the status is only worth printing when it
  // says something the message does not — "FETCH_ERROR" beside "TypeError: Failed to fetch", say.
  const message = errorMessage(error);
  const label = status === undefined || status === null ? t('offline.nostatus') : String(status);
  const detail = message.includes(label) ? message : `${label} · ${message}`;
  return (
    <Alert $tone="warning" role="alert" style={{ marginTop: 16 }} data-testid="offline">
      <Row>
        <Text>
          <strong>{t('offline.title')}</strong>
          {t('offline.body', { what })}
          {!!error && <> {t('offline.detail', { detail })}</>}
        </Text>
        <Button size="small" color="secondary" onClick={onRetry} loading={retrying} data-testid="offline-retry">{t('offline.retry')}</Button>
      </Row>
    </Alert>
  );
}
