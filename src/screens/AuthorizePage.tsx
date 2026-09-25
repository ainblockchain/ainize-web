import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import styled from 'styled-components';
import { errorMessage, useApproveDeviceMutation, useDeviceRequestQuery } from '@/api/api';
import { connect, discoverWallets, personalSign, WalletError, type DiscoveredWallet } from '@/lib/ethWallet';
import { useAuth } from '@/auth/AuthContext';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { Alert } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { CenterProgress, Description, KeyValue, Mono, PageWrapper, Title } from '@/components/ui/Misc';
import { dateTime } from '@/utils/format';

/**
 * What a command line's URL opens.
 *
 * This is the one prompt in the product whose wrong click has a lasting consequence. A sign-in expires; this does
 * not — it writes down that a key acts as you, and from then on that key needs no wallet. So the page is built to
 * be READ rather than clicked through: what is being authorised is above the button, the key is shown in full
 * rather than abbreviated, and the exact bytes the wallet will sign are on the page beside it.
 *
 * That last one is the point. The node composes the message and stores it; this page renders THAT string rather
 * than writing its own description from the fields around it. A page saying one thing while the wallet signs
 * another is the whole attack, and it cannot happen if there is only one string.
 */
const Panel = styled.div`max-width: 620px; margin-top: 32px;`;
const Signed = styled.pre`
  margin: 10px 0 0; padding: 14px 16px; border: 1px solid #e5e5e8; border-radius: 6px;
  background: #fafafa; font-family: ${(p) => p.theme.font.mono}; font-size: 12.5px; line-height: 1.7; color: #333;
  white-space: pre-wrap; word-break: break-all;
`;
const Row = styled.div`display: flex; gap: 12px; align-items: center; margin-top: 28px; flex-wrap: wrap;`;
const Muted = styled.p`margin: 10px 0 0; font-size: 12.5px; line-height: 1.7; color: ${(p) => p.theme.color.GREY}; word-break: keep-all;`;
const Label = styled.span`font-size: 13px; color: ${(p) => p.theme.color.GREY}; margin-left: 8px;`;

export default function AuthorizePage() {
  const { t } = useT();
  useTitle(t('op.authorize.title'));
  const [params] = useSearchParams();
  const code = params.get('code') ?? '';
  const auth = useAuth();
  const { data, isLoading, error, refetch } = useDeviceRequestQuery(code, { skip: !code });
  const [approveDevice, approveState] = useApproveDeviceMutation();
  const [wallets, setWallets] = useState<DiscoveredWallet[] | null>(null);
  const [outcome, setOutcome] = useState<'approved' | 'rejected' | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  useEffect(() => { let live = true; void discoverWallets().then((w) => { if (live) setWallets(w); }); return () => { live = false; }; }, []);

  if (!code) return <PageWrapper><Title>{t('op.authorize.title')}</Title><Alert $tone="error">{t('op.authorize.no_code')}</Alert></PageWrapper>;
  if (isLoading) return <PageWrapper><CenterProgress /></PageWrapper>;
  if (error || !data) return <PageWrapper><Title>{t('op.authorize.title')}</Title><Alert $tone="error">{t('op.authorize.unknown')}</Alert></PageWrapper>;

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

  const approve = async () => {
    setLocalError(null);
    try {
      const w = wallets?.[0];
      if (!w) throw new WalletError('no_extension');
      const address = await connect(w.provider);
      // Signed exactly as shown, and the wallet's answer is recovered here against the same string before it is
      // sent — the node will check it against its stored copy, so a mismatch has to surface now, not as a 401.
      const signature = await personalSign(w.provider, data.message, address);
      await approveDevice({ code, signature }).unwrap();
      setOutcome('approved');
      void refetch();
    } catch (e) {
      setLocalError(e instanceof WalletError ? t(`op.sign.wallet.err_${e.message}`) : errorMessage(e));
    }
  };

  if (outcome === 'approved') {
    return (
      <PageWrapper>
        <Title>{tt('title')}</Title>
        <Panel>
          <Alert $tone="success" data-testid="authorize-done">{tt('done')}</Alert>
          {/* Where the person actually wanted to go. What they just approved was most often a NODE asking to
              belong to them, and the page that shows that is the list of their nodes — the account page shows
              keys, which is the other half and not the half they came for. */}
          <Muted>{t('op.authorize.done_end')} <Link to="/my-nodes">{t('op.mynodes.title')} →</Link>{' · '}<Link to="/account">{t('nav.account')} →</Link></Muted>
        </Panel>
      </PageWrapper>
    );
  }
  if (outcome === 'rejected') {
    return <PageWrapper><Title>{tt('title')}</Title><Panel><Alert $tone="info" data-testid="authorize-rejected">{tt('rejected')}</Alert></Panel></PageWrapper>;
  }
  // A request that is over is not a button that fails: each of these is a different thing to do next, and saying
  // which is the difference between "run it again" and "you already did this".
  const over = data.status === 'expired' ? tt('expired') : data.status !== 'pending' ? t('op.authorize.used') : null;
  if (over) return <PageWrapper><Title>{tt('title')}</Title><Panel><Alert $tone="info" data-testid="authorize-over">{over}</Alert></Panel></PageWrapper>;

  return (
    <PageWrapper>
      <Title>{tt('title')}</Title>
      <Description>{tt('lead')}</Description>
      <Panel>
        <KeyValue data-testid="authorize-what">
          {/* In full, never abbreviated: this is the one field worth comparing character by character against what
              the terminal printed, and `0x04…cb55` is not comparable to anything. */}
          <dt>{tt('key')}</dt><dd><Mono>{data.delegate}</Mono></dd>
          {data.label && <><dt>{t('op.authorize.label')}</dt><dd>“{data.label}”<Label>{tt('label_hint')}</Label></dd></>}
          <dt>{t('op.authorize.node')}</dt><dd>{data.name} <Mono>{data.node.slice(0, 10)}…{data.node.slice(-4)}</Mono></dd>
          <dt>{t('op.authorize.until')}</dt><dd>{dateTime(data.expires)}</dd>
        </KeyValue>

        <Muted style={{ marginTop: 22 }}>{t('op.authorize.message')}</Muted>
        <Signed data-testid="authorize-message">{data.message}</Signed>

        {!auth.subject && <Alert $tone="info" style={{ marginTop: 18 }}>{t('op.authorize.signin_first')}</Alert>}
        {wallets !== null && wallets.length === 0 && <Alert $tone="error" style={{ marginTop: 18 }}>{t('op.sign.wallet.err_no_extension')}</Alert>}
        {localError && <Alert $tone="error" role="alert" style={{ marginTop: 18 }}>{localError}</Alert>}

        <Row>
          <Button onClick={() => void approve()} disabled={approveState.isLoading || !wallets?.length} data-testid="authorize-approve">
            {approveState.isLoading ? t('op.authorize.busy') : tt('approve')}
          </Button>
          {/* Rejecting writes nothing: the request simply runs out. Saying so is better than a button that looks
              like it revokes something. */}
          <Button variant="text" onClick={() => setOutcome('rejected')} data-testid="authorize-reject">{t('op.authorize.reject')}</Button>
        </Row>
      </Panel>
    </PageWrapper>
  );
}
