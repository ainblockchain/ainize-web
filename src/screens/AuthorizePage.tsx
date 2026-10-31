import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import styled from 'styled-components';
import { errorMessage, useApproveAccountDeviceMutation, useApproveDeviceMutation, useDeviceRequestQuery } from '@/api/api';
import { connect, discoverWallets, personalSign, WalletError, type DiscoveredWallet } from '@/lib/ethWallet';
import { useAuth } from '@/auth/AuthContext';
import { useT } from '@/i18n';
import { useActiveView } from '@/hooks/useActiveView';
import { createNodeActionTask } from '@/lib/accountNodeActions';
import { approveReviewedDevice, deviceApprovedFor, selectedDeviceCode, readDeviceRequest, sameDeviceRequest, DeviceApprovalError } from '@/lib/deviceApproval';
import type { DeviceRequest } from '@/api/types';
import { useTitle } from '@/utils/useTitle';
import { Alert } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { QueryError } from '@/components/operator/common';
import { CenterProgress, Description, KeyValue, Mono, PageWrapper, Title } from '@/components/ui/Misc';
import { dateTime } from '@/utils/format';

/** A terminal request is reviewed once, then approved using the current AIN account.
 * Wallet delegation remains available on nodes that use wallet sign-in. */
const Panel = styled.div`max-width: 620px; margin-top: 32px; dd { min-width: 0; overflow-wrap: anywhere; }`;
const Signed = styled.pre`
  margin: 10px 0 0; padding: 14px 16px; border: 1px solid #e5e5e8; border-radius: 6px;
  background: #fafafa; font-family: ${(p) => p.theme.font.mono}; font-size: 12.5px; line-height: 1.7; color: #333;
  white-space: pre-wrap; word-break: break-all;
`;
const Row = styled.div`display: flex; gap: 12px; align-items: center; margin-top: 28px; flex-wrap: wrap;`;
const Muted = styled.p`margin: 10px 0 0; font-size: 12.5px; line-height: 1.7; color: ${(p) => p.theme.color.GREY}; word-break: keep-all;`;
const Label = styled.span`font-size: 13px; color: ${(p) => p.theme.color.GREY}; margin-left: 8px;`;

export default function AuthorizePage() {
  const [params] = useSearchParams();
  const auth = useAuth();
  return <DeviceApproval key={`${selectedDeviceCode(params) ?? 'invalid'}:${auth.cacheIdentity}`} />;
}

function DeviceApproval() {
  const { t } = useT();
  useTitle(t('op.authorize.title'));
  const [params] = useSearchParams();
  const code = selectedDeviceCode(params) ?? '';
  const auth = useAuth();
  const { currentData, isLoading, isFetching, error, refetch } = useDeviceRequestQuery(code, { skip: !code, refetchOnMountOrArgChange: true });
  const active = useActiveView();
  const [task] = useState(createNodeActionTask), [busy, setBusy] = useState(false), [attempted, setAttempted] = useState(false);
  const [reviewed, setReviewed] = useState<DeviceRequest | null>(null), [receipt, setReceipt] = useState<DeviceRequest | null>(null);
  const current = () => active() && auth.isCurrentAccount();
  useEffect(() => () => task.abandon(), [task]);
  const incoming = !error ? readDeviceRequest(currentData) : null;
  const mismatched = !!(attempted && reviewed && incoming && !sameDeviceRequest(reviewed, incoming));
  const data = receipt ?? (mismatched ? reviewed : incoming) ?? (attempted ? reviewed : null);
  const [approveAccount] = useApproveAccountDeviceMutation();
  const [approveDevice] = useApproveDeviceMutation();
  const [wallets, setWallets] = useState<DiscoveredWallet[] | null>(null);
  const [walletIndex, setWalletIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const accountMode = !!auth.sso || (auth.ssoConfigured && !auth.subject);
  const actor = auth.sso?.principal ?? auth.subject ?? '';
  const loginHref = `/api/auth/sso/start?next=${encodeURIComponent(`/authorize?code=${encodeURIComponent(code)}`)}`;
  const redirected = useRef(false);
  useEffect(() => {
    if (!auth.loading && accountMode && !auth.sso && data?.status === 'pending' && !isFetching && !error && !dismissed && !redirected.current) {
      redirected.current = true;
      window.location.replace(loginHref);
    }
  }, [auth.loading, accountMode, auth.sso, data?.status, isFetching, error, dismissed, loginHref]);
  useEffect(() => { if (accountMode || !auth.subject) return; let live = true; void discoverWallets().then((w) => { if (live) setWallets(w); }); return () => { live = false; }; }, [accountMode, auth.subject]);

  if (!code) return <PageWrapper><Title>{t('op.authorize.title')}</Title><Alert $tone="error">{t('op.authorize.no_code')}</Alert></PageWrapper>;
  if (isLoading || (!data && isFetching) || auth.loading) return <PageWrapper><CenterProgress /></PageWrapper>;
  if (!attempted && !receipt && error && !('status' in error && error.status === 404)) return <PageWrapper><Title>{t('op.authorize.title')}</Title><QueryError error={error} what={t('op.authorize.title')} onRetry={() => void refetch()} retrying={isFetching} /></PageWrapper>;
  if ((!attempted && !receipt && error) || (!data && !currentData)) return <PageWrapper><Title>{t('op.authorize.title')}</Title><Alert $tone="error">{t('op.authorize.unknown')}</Alert></PageWrapper>;

  if (!data || mismatched) return <PageWrapper><Title>{t('op.authorize.title')}</Title><QueryError error={error} what={t('op.authorize.title')} onRetry={() => void refetch()} retrying={isFetching} /></PageWrapper>;

  /**
   * Which of the two things is asking.
   *
   * One request shape serves a command line somebody just ran and a node that started in another room and
   * printed its own link. The page described only the first: a person approving a node read "Authorize a
   * command line?" and was told to reject it unless they had just run `ainize login` — advice to refuse the
   * thing they came to approve. `kind` is what the node recorded when the request was made.
   *
   * The three screens above this line run before the request has been read, so they keep the neutral title:
   * a page that does not yet know what is asking must not guess.
   */
  const k = data.kind === 'node' ? 'node' : 'cli';
  const tt = (key: string) => t(`op.authorize.${k}.${key}`);

  const refresh = async () => {
    try {
      const result = readDeviceRequest(await refetch().unwrap());
      if (!current()) return;
      if (!result || reviewed && !sameDeviceRequest(reviewed, result)) throw new DeviceApprovalError('changed');
      if (deviceApprovedFor(result, actor)) { setReceipt(result); setLocalError(null); }
    } catch (e) { if (current()) setLocalError(t('op.authorize.error.read')); }
  };
  const approve = async () => {
    if (!data || busy || task.pending() || attempted || isFetching || !current()) return;
    const wallet = wallets?.[walletIndex];
    setBusy(true); setLocalError(null); setReviewed(data);
    try {
      const result = await task.run(current, current => approveReviewedDevice(data, actor, {
        current, read: () => refetch().unwrap(), attempting: () => setAttempted(true),
        ...(auth.sso ? {} : { prove: async (message: string) => {
          if (!wallet) throw new WalletError('no_extension');
          const address = await connect(wallet.provider);
          if (!current()) throw new DeviceApprovalError('changed');
          if (address.toLowerCase() !== actor.toLowerCase()) throw new Error(t('op.authorize.wallet_mismatch'));
          return personalSign(wallet.provider, message, address);
        } }),
        write: (expected, signature) => auth.sso ? approveAccount({ code, expected }).unwrap() : approveDevice({ code, signature: signature! }).unwrap(),
      }));
      if (result && current()) setReceipt(result);
    } catch (e) {
      if (current()) setLocalError(e instanceof DeviceApprovalError ? t(`op.authorize.error.${e.code}`) : e instanceof WalletError ? t(`op.sign.wallet.err_${e.message}`) : errorMessage(e));
    } finally { if (current()) setBusy(false); }
  };

  if (receipt || deviceApprovedFor(data, actor)) {
    return (
      <PageWrapper>
        <Title>{tt('title')}</Title>
        <Panel>
          <Alert $tone="success" data-testid="authorize-done">{tt('done')}</Alert>
          <Muted>{accountMode ? t('op.authorize.account.done_end') : t('op.authorize.done_end')}{' '}
            {k === 'node' && <><Link to="/my-nodes">{t('op.mynodes.title')} →</Link>{' · '}</>}
            <Link to={accountMode ? '/me' : '/account'}>{t('nav.account')} →</Link>
          </Muted>
        </Panel>
      </PageWrapper>
    );
  }
  if (dismissed) {
    return <PageWrapper><Title>{tt('title')}</Title><Panel><Alert $tone="info" data-testid="authorize-dismissed">{t('op.authorize.dismissed')}</Alert></Panel></PageWrapper>;
  }
  // A request that is over is not a button that fails: each of these is a different thing to do next, and saying
  // which is the difference between "run it again" and "you already did this".
  const over = data.status === 'expired' ? tt('expired') : data.status !== 'pending' ? t('op.authorize.used') : null;
  if (over) return <PageWrapper><Title>{tt('title')}</Title><Panel><Alert $tone="info" data-testid="authorize-over">{over}</Alert></Panel></PageWrapper>;

  return (
    <PageWrapper>
      <Title>{tt('title')}</Title>
      <Description>{accountMode ? t(`op.authorize.account.${k}.lead`) : tt('lead')}</Description>
      <Panel>
        <KeyValue data-testid="authorize-what">
          {/* In full, never abbreviated: this is the one field worth comparing character by character against what
              the terminal printed, and `0x04…cb55` is not comparable to anything. */}
          <dt>{tt('key')}</dt><dd><Mono>{data.delegate}</Mono></dd>
          {data.label && <><dt>{t('op.authorize.label')}</dt><dd>“{data.label}”<Label>{tt('label_hint')}</Label></dd></>}
          <dt>{t('op.authorize.node')}</dt><dd>{data.name} <Mono>{data.node}</Mono></dd>
          <dt>{t('op.authorize.until')}</dt><dd>{accountMode && k === 'cli' ? t('op.authorize.account.until') : dateTime(data.expires)}</dd>
        </KeyValue>

        {!accountMode && <><Muted style={{ marginTop: 22 }}>{t('op.authorize.message')}</Muted>
        <Signed data-testid="authorize-message">{data.message}</Signed></>}
        {accountMode && auth.sso && <Muted data-testid="authorize-account">{t('op.authorize.account.as')}: {auth.sso.name || auth.sso.email || auth.sso.sub}</Muted>}
        {accountMode && !auth.sso && <Alert $tone="info" data-testid="authorize-login"><a href={loginHref}>{t('op.authorize.account.signin')}</a></Alert>}

        {!accountMode && !auth.subject && <Alert $tone="info" style={{ marginTop: 18 }}><Link to={`/signing?wallet=1&next=${encodeURIComponent(`/authorize?code=${code}`)}`}>{t('op.authorize.signin_first')}</Link></Alert>}
        {!accountMode && wallets && wallets.length > 1 && <select disabled={busy || attempted} aria-label={t('op.sign.wallet.pick')} value={walletIndex} onChange={e => setWalletIndex(Number(e.target.value))}>{wallets.map((w, i) => <option key={w.info.uuid} value={i}>{w.info.name}</option>)}</select>}
        {!accountMode && wallets !== null && wallets.length === 0 && <Alert $tone="error" style={{ marginTop: 18 }}>{t('op.sign.wallet.err_no_extension')}</Alert>}
        {localError && <Alert $tone="error" role="alert" style={{ marginTop: 18 }}>{localError}</Alert>}

        {attempted && busy && <Alert $tone="info" role="status">{t('op.authorize.account.busy')}</Alert>}
        {attempted && !busy && <Alert $tone="warning" role="status" data-testid="authorize-unconfirmed">{t('op.authorize.error.unconfirmed')}</Alert>}
        <Row>
          {!attempted && <Button onClick={() => void approve()} disabled={busy || isFetching || !actor || (accountMode ? !auth.sso : !auth.subject || !wallets?.length)} data-testid="authorize-approve">
            {busy ? t('op.authorize.account.busy') : accountMode ? t(`op.authorize.account.${k}.approve`) : tt('approve')}
          </Button>}
          {attempted && <Button variant="text" disabled={busy || isFetching} onClick={() => void refresh()} data-testid="authorize-refresh">{t('op.authorize.refresh')}</Button>}
          {!attempted && <Button variant="text" disabled={busy} onClick={() => { if (!task.pending()) setDismissed(true); }} data-testid="authorize-dismiss">{t('op.authorize.dismiss')}</Button>}
        </Row>
      </Panel>
    </PageWrapper>
  );
}
