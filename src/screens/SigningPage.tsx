import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import styled from 'styled-components';
import { errorMessage, useEnrollMutation, useLoginChallengeMutation, useLoginWalletMutation, useMeQuery } from '@/api/api';
import { connect, discoverWallets, personalSign, WalletError, type DiscoveredWallet } from '@/lib/ethWallet';
import { useAuth } from '@/auth/AuthContext';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { Alert } from '@/components/ui/Form';
import { Mono, PageWrapper, Title } from '@/components/ui/Misc';

const OptionContainer = styled.div`margin-top: 40px; max-width: 460px;`;
const StyledLink = styled(Link)`color: ${(p) => p.theme.color.PRIMARY}; text-decoration: none; &:hover { border-bottom: 1px solid #8b3eeb; }`;
const Outbound = styled.a`color: ${(p) => p.theme.color.PRIMARY}; text-decoration: none; &:hover { border-bottom: 1px solid #8b3eeb; }`;
const ConfirmButton = styled.button`
  width: 196px; height: 44px; margin-top: 32px; border: 0; border-radius: 4px; background: ${(p) => p.theme.color.PRIMARY}; color: #fff;
  font-size: 16px; font-weight: 500; cursor: pointer; transition: background 0.2s ease;
  &:hover { background: ${(p) => p.theme.color.HOVER}; } &:disabled { background: ${(p) => p.theme.color.PRESSED}; cursor: not-allowed; }
`;
const Hint = styled.p`
  margin: 12px 0 0; font-size: 13px; line-height: 1.7; color: ${(p) => p.theme.color.GREY}; word-break: keep-all;
  code { font-family: ${(p) => p.theme.font.mono}; font-size: 12.5px; background: #f4f4f5; border-radius: 3px; padding: 1px 5px; color: ${(p) => p.theme.color.BLACK}; }
`;
const EnrollRow = styled.div`margin-top: 14px;`;
const Who = styled.p`margin: 8px 0 0; font-size: 13.5px; color: ${(p) => p.theme.color.GREY};`;
const Fine = styled.p`margin: 24px 0 0; font-size: 12.5px; color: ${(p) => p.theme.color.GREY};`;
const WalletButton = styled.button`
  min-width: 196px; height: 44px; padding: 0 16px; border: 1px solid ${(p) => p.theme.color.PRIMARY}; border-radius: 4px; background: #fff;
  color: ${(p) => p.theme.color.PRIMARY}; font-size: 15px; font-weight: 500; cursor: pointer; text-align: left;
  display: inline-flex; align-items: center; gap: 10px;
  &:hover { background: ${(p) => p.theme.color.PALE_GREY}; } &:disabled { opacity: .55; cursor: not-allowed; }
  img { width: 20px; height: 20px; border-radius: 4px; }
`;
const WalletList = styled.div`margin-top: 32px; display: flex; flex-direction: column; gap: 10px; align-items: flex-start;`;

export default function SigningPage() {
  const { t, locale } = useT();
  useTitle(t('nav.signin'));
  const auth = useAuth();
  const { data: me } = useMeQuery();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = params.get('next') || '/dashboard';
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * One control, and what it needs to be acted on.
   *
   * There is no password and there is no operator login. What this page does is connect a wallet: the person signs
   * one readable message, the node learns which address is here, and whether that address happens to OWN this node
   * is a separate question the node answers by itself. Most people who sign in will not own it, and that is not an
   * error state — it is the ordinary case.
   *
   * Wallets are discovered rather than assumed (EIP-6963), so a browser with two installed offers both instead of
   * silently using whichever won a race at page load. One wallet, one button; several, a short list.
   */
  const [wallets, setWallets] = useState<DiscoveredWallet[] | null>(null);
  useEffect(() => { let live = true; void discoverWallets().then((w) => { if (live) setWallets(w); }); return () => { live = false; }; }, []);
  const [challenge] = useLoginChallengeMutation();
  const [loginWallet] = useLoginWalletMutation();
  const [enroll] = useEnrollMutation();

  useEffect(() => { if (!auth.loading && auth.isSignedIn) navigate(next, { replace: true }); }, [auth.loading, auth.isSignedIn, navigate, next]);

  const signInError = (e: unknown): string => {
    const r = e as { status?: number | string; data?: { error?: string; retry_after_s?: number; attempts?: number } } | null | undefined;
    // The node's own refusals name the address and say what would allow it — better than anything this page could
    // invent — so they are shown as sent. Only the throttle gets a translated sentence, because it carries two
    // numbers a reader needs and would otherwise arrive as an English server string.
    if (r?.status === 429) return t('op.sign.err.throttled', { n: r.data?.attempts ?? 0, s: r.data?.retry_after_s ?? 0 });
    return errorMessage(e);
  };

  const signIn = async (w: DiscoveredWallet, alsoEnroll: boolean) => {
    setLocalError(null); setBusy(true);
    try {
      const address = await connect(w.provider);
      // `eip191` is stated, not inferred. The node fixes the scheme to the challenge it issues, so what comes back
      // in `message` is already the readable wallet form — and `personalSign` verifies the wallet's answer against
      // that exact string before it goes anywhere.
      const ch = await challenge({ scheme: 'eip191' }).unwrap();
      const signature = await personalSign(w.provider, ch.message, address);
      await (alsoEnroll ? enroll : loginWallet)({ address, nonce: ch.nonce, signature }).unwrap();
      await auth.refresh();
      navigate(next, { replace: true });
    } catch (e) {
      setLocalError(e instanceof WalletError ? t(`op.sign.wallet.err_${e.message}`) : signInError(e));
    } finally { setBusy(false); }
  };

  const loginDocs = locale === 'ko' ? '/docs/ko/get-started/quickstart#5-로그인' : '/docs/get-started/quickstart#5-log-in';
  const [agreeBefore, agreeAfter] = t('op.sign.agree', { terms: '|' }).split('|');

  return (
    <PageWrapper>
      <Title>{t('op.sign.login.title')}</Title>
      {/* Which node, on one line: signing into the wrong one is a real mistake, and the name and address are what
          tell you it is the one you meant. */}
      {me && <Who data-testid="sign-node">{me.name} <Mono>{me.address.slice(0, 10)}…{me.address.slice(-4)}</Mono></Who>}

      <OptionContainer>
        {wallets !== null && wallets.length === 0 && (
          <Alert $tone="info" data-testid="no-wallet">
            {t('op.sign.key.no_wallet')}
            <Hint>
              <Outbound href="https://metamask.io/download/" target="_blank" rel="noreferrer noopener">{t('op.sign.wallet.no_install')} →</Outbound>
              {' · '}<code>ainize login</code> — {t('op.sign.key.no_wallet_cmd')}{' '}
              <StyledLink to={loginDocs}>{t('op.sign.login.where_link')} →</StyledLink>
            </Hint>
          </Alert>
        )}

        {/* One wallet is a button. Several is a choice, and making it for them would pick the wrong address about
            as often as not. */}
        {wallets && wallets.length === 1 && (
          <ConfirmButton type="button" onClick={() => void signIn(wallets[0]!, false)} disabled={busy} data-testid="wallet-signin">
            {busy ? t('op.sign.wallet.busy') : t('op.sign.wallet.button')}
          </ConfirmButton>
        )}
        {wallets && wallets.length > 1 && (
          <>
            <Hint style={{ marginTop: 24 }}>{t('op.sign.wallet.pick')}</Hint>
            <WalletList data-testid="wallet-picker">
              {wallets.map((w) => (
                <WalletButton key={w.info.uuid} type="button" onClick={() => void signIn(w, false)} disabled={busy}>
                  {w.info.icon && <img src={w.info.icon} alt="" />}{w.info.name}
                </WalletButton>
              ))}
            </WalletList>
          </>
        )}

        {wallets && wallets.length > 0 && (
          <>
            <Hint>{t('op.sign.wallet.what')}</Hint>
            {/* Offered only when the node says this caller could actually do it — from its own machine, or with the
                one-time token. Shown to anyone else it would be a button that always fails. */}
            {me?.canEnroll && (
              <EnrollRow>
                <WalletButton type="button" onClick={() => void signIn(wallets[0]!, true)} disabled={busy}>{t('op.sign.key.enroll')}</WalletButton>
              </EnrollRow>
            )}
          </>
        )}

        {localError && <Alert $tone="error" role="alert" style={{ marginTop: 16 }}>{localError}</Alert>}
        <Fine>
          {agreeBefore}<StyledLink to="/terms">{t('op.sign.terms')}</StyledLink>{agreeAfter}
          {' · '}<StyledLink to="/chat">{t('op.sign.visitor_cta')}</StyledLink>
        </Fine>
      </OptionContainer>
    </PageWrapper>
  );
}
