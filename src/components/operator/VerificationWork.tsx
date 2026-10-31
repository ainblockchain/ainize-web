import styled from 'styled-components';
import { useLedgerQuery, useWalletQuery } from '@/api/api';
import { useAuth } from '@/auth/AuthContext';
import { useT } from '@/i18n';
import { verificationPayments, verificationWindow } from '@/lib/dashboardView';
import { num } from '@/utils/format';
import { CenterProgress, StyledLink } from '@/components/ui/Misc';
import { QueryError, useMoney } from './common';

const Card = styled.section`
  display: flex; flex-wrap: wrap; gap: 16px 32px; padding: 18px 22px; margin-bottom: 24px;
  background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
`;
const Stat = styled.div`
  display: flex; flex-direction: column; min-width: 92px;
  b { font-size: 20px; font-weight: 500; font-variant-numeric: tabular-nums; color: ${(p) => p.theme.color.BLACK}; }
  b.bad { color: ${(p) => p.theme.color.ERROR}; }
  span { margin-top: 3px; font-size: 12px; color: ${(p) => p.theme.color.GREY}; }
`;
const Note = styled.div`flex: 1 1 100%; min-width: 0; font-size: 12px; color: ${(p) => p.theme.color.GREY}; overflow-wrap: anywhere;`;
const Payments = styled.div`flex: 1 1 100%; display: flex; flex-wrap: wrap; gap: 16px 32px; min-width: 0;`;

/** Bounded public work and private payment evidence remain independent reads. */
export function VerificationWork({ address }: { address: string }) {
  const { t, tech, help } = useT();
  const money = useMoney();
  const auth = useAuth();
  const attests = useLedgerQuery({ kind: 'attest', limit: 5000 });
  const wallet = useWalletQuery({ identity: auth.cacheIdentity }, { skip: auth.loading });
  const work = !attests.isError ? verificationWindow(attests.currentData, address) : null;
  const payments = !auth.loading && !wallet.isError ? verificationPayments(wallet.currentData) : null;
  return (
    <Card data-testid="dash-verification" aria-label={t('op.dash.verify.title')}>
      {attests.isError || !work && !attests.isFetching
        ? <QueryError error={attests.error} what={t('op.dash.verify.title')} retrying={attests.isFetching} onRetry={() => void attests.refetch()} />
        : !work ? <Note data-testid="verification-loading"><CenterProgress /></Note> : <>
          <Stat><b>{num(work.total)}</b><span title={`${help('signedResult')} (${tech('signedResult')})`}>{t('op.dash.verify.attested')}</span></Stat>
          <Stat><b>{num(work.passed)}</b><span>{t('op.dash.verify.passed')}</span></Stat>
          <Stat><b className={work.failed ? 'bad' : undefined}>{num(work.failed)}</b><span>{t('op.dash.verify.failed')}</span></Stat>
          <Stat><b>{num(work.hashOnly)}</b><span title={t('op.dash.verify.hash_help')}>{t('op.dash.verify.hash')}</span></Stat>
          <Stat><b>{num(work.knowledges)}</b><span>{t('op.dash.verify.knowledges')}</span></Stat>
          <Note>{t('op.dash.verify.window', { shown: num(work.shown), total: num(work.ledgerTotal), limit: num(5000) })} {t('op.dash.verify.network', { total: num(work.shown), failed: num(work.networkFailed) })} <StyledLink to="/ledger">{t('op.dash.verify.records')}</StyledLink></Note>
        </>}
      <Payments data-testid="verification-payments">
        {auth.loading || !payments && wallet.isFetching ? <CenterProgress />
          : wallet.isError || !payments ? <QueryError error={wallet.error} what={t('op.dash.verify.payments')} retrying={wallet.isFetching} onRetry={() => void wallet.refetch()} />
          : payments.length === 0 ? <Note>{t('op.dash.verify.no_payments')}</Note>
          : payments.map(p => <Stat key={JSON.stringify([p.currency, p.state, p.evidence])}>
            <b>{money.revenue(p.amount, p.currency)}</b>
            <span>{t(`op.dash.verify.payment.${p.state}`)}</span>
            {p.state === 'paid' && <span>{t(`op.dash.verify.evidence.${p.evidence}`)}</span>}
          </Stat>)}
      </Payments>
      <Note>{t('op.dash.verify.note')}</Note>
    </Card>
  );
}
