import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import styled from 'styled-components';
import { errorMessage, useEnrollMutation, useLoginChallengeMutation, useLoginWalletMutation, useMeQuery } from '@/api/api';
import { hasAinWallet, recoverAddress, walletAddress, whenAinWallet, WalletError } from '@/lib/ainWallet';
import { useAuth } from '@/auth/AuthContext';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { Alert } from '@/components/ui/Form';
import { Mono, PageWrapper, Title } from '@/components/ui/Misc';

/** ainize SigningPage: 32px title, description, options block, 196px purple confirm button. */
const OptionContainer = styled.div`margin-top: 40px; max-width: 420px;`;
const StyledLink = styled(Link)`color: ${(p) => p.theme.color.PRIMARY}; text-decoration: none; &:hover { border-bottom: 1px solid #8b3eeb; }`;
const ConfirmButton = styled.button`
  width: 196px; height: 44px; margin-top: 32px; border: 0; border-radius: 4px; background: ${(p) => p.theme.color.PRIMARY}; color: #fff;
  font-size: 16px; font-weight: 500; cursor: pointer; transition: background 0.2s ease;
  &:hover { background: ${(p) => p.theme.color.HOVER}; } &:disabled { background: ${(p) => p.theme.color.PRESSED}; cursor: not-allowed; }
`;
/** Visitors land here by mistake (old bookmarks, the operator link on the landing page): tell them teaching / testing needs no sign-in (spec §5.2). */
/** Finding 71: the invited person could not fill this field because nothing said where the password comes from. */
const Hint = styled.p`
  margin: 12px 0 0; font-size: 13px; line-height: 1.7; color: ${(p) => p.theme.color.GREY}; word-break: keep-all;
  code { font-family: ${(p) => p.theme.font.mono}; font-size: 12.5px; background: #f4f4f5; border-radius: 3px; padding: 1px 5px; color: ${(p) => p.theme.color.BLACK}; }
`;
const EnrollRow = styled.div`margin-top: 14px;`;
const Who = styled.p`margin: 8px 0 0; font-size: 13.5px; color: ${(p) => p.theme.color.GREY};`;
const Fine = styled.p`margin: 24px 0 0; font-size: 12.5px; color: ${(p) => p.theme.color.GREY};`;
const WalletButton = styled.button`
  width: 196px; height: 44px; border: 1px solid ${(p) => p.theme.color.PRIMARY}; border-radius: 4px; background: #fff;
  color: ${(p) => p.theme.color.PRIMARY}; font-size: 15px; font-weight: 500; cursor: pointer;
  &:hover { background: ${(p) => p.theme.color.PALE_GREY}; } &:disabled { opacity: .55; cursor: not-allowed; }
`;

export default function SigningPage() {
  const { t, tech, locale } = useT();
  useTitle(t('nav.signin'));
  const auth = useAuth();
  const { data: me } = useMeQuery();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = params.get('next') || '/dashboard';
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /**
   * There is no password any more.
   *
   * It was the one shared secret in a product whose entire identity model is "a key signs for itself": typed into
   * a browser, stored as a hash by the thing it protected, and unrotatable without signing everyone out. Sign-in
   * is a signature — the node's own key, which lives on its machine, plus whatever addresses its operator listed.
   *
   * So this page has exactly one control, and it is only useful with the extension. A person without one is not
   * shown a form that cannot work: they are told the command that signs in on the node's own machine, which is
   * where that key is.
   */
  const [wallet, setWallet] = useState<boolean | null>(null);
  useEffect(() => { let live = true; void whenAinWallet().then((ok) => { if (live) setWallet(ok); }); return () => { live = false; }; }, []);
  const [challenge] = useLoginChallengeMutation();
  const [loginWallet] = useLoginWalletMutation();
  const [enroll] = useEnrollMutation();

  useEffect(() => { if (!auth.loading && auth.isSignedIn) navigate(next, { replace: true }); }, [auth.loading, auth.isSignedIn, navigate, next]);

  const signInError = (e: unknown): string => {
    const r = e as { status?: number | string; data?: { error?: string; retry_after_s?: number; attempts?: number } } | null | undefined;
    // The node's 403 names the address and says exactly how it would be allowed — better than anything this page
    // could invent — so it is shown as sent. Only the throttle gets a translated sentence, because it carries the
    // two numbers a reader needs and would otherwise arrive as an English server string.
    if (r?.status === 429) return t('op.sign.err.throttled', { n: r.data?.attempts ?? 0, s: r.data?.retry_after_s ?? 0 });
    return errorMessage(e);
  };

  const signIn = async (alsoEnroll: boolean) => {
    setLocalError(null); setBusy(true);
    try {
      if (!hasAinWallet()) throw new WalletError('no_extension');
      const address = await walletAddress();
      if (!address) throw new WalletError('locked');
      const ch = await challenge().unwrap();
      const signature = await window.ainetwork!.signMessage!(ch.message);
      // Recovered here on purpose: the extension is a different codebase signing with a different library, and an
      // unchecked format divergence becomes an opaque 401 later, on a route that has nothing to do with signing.
      if (recoverAddress(ch.message, signature)?.toLowerCase() !== address.toLowerCase()) throw new WalletError('signature_mismatch');
      await (alsoEnroll ? enroll : loginWallet)({ address, nonce: ch.nonce, signature }).unwrap();
      auth.refresh();
      navigate(next, { replace: true });
    } catch (e) {
      setLocalError(e instanceof WalletError ? t(`op.sign.wallet.err_${e.message}`) : signInError(e));
    } finally { setBusy(false); }
  };

  const loginDocs = locale === 'ko' ? '/docs/ko/get-started/quickstart#5-로그인' : '/docs/get-started/quickstart#5-log-in';
  const roleLabel = (r: string) => { const k = `op.role.${r}`; const v = t(k); return v === k ? r : v; };
  const [agreeBefore, agreeAfter] = t('op.sign.agree', { terms: '|' }).split('|');

  /**
   * One control, and what it needs to be acted on.
   *
   * This page had a title, a subtitle and a description saying the same thing three times, a hint under the
   * button, a hint under the second button, a notice for people who landed here by mistake, and a four-row box
   * describing the node. Around ONE button. Everything below is either the action, the way to recover when the
   * action is unavailable, or the one fact a person must check before signing in — which node this is, because
   * signing into the wrong one is a real mistake and it fits on a line.
   */
  return (
    <PageWrapper>
      <Title>{t('op.sign.login.title')}</Title>
      {/* Which node, on one line. The old box gave its name, address, roles and a note about key pairs; the name
          and the address are what tell you it is yours, and nothing else on this page depends on the rest. */}
      {me && <Who data-testid="sign-node">{me.name} <Mono>{me.address.slice(0, 10)}…{me.address.slice(-4)}</Mono></Who>}

      <OptionContainer>
        {wallet === false && (
          <Alert $tone="info" data-testid="no-wallet">
            {t('op.sign.key.no_wallet')}
            <Hint><code>ainize login</code> — {t('op.sign.key.no_wallet_cmd')}{' '}
              <StyledLink to={loginDocs}>{t('op.sign.login.where_link')} →</StyledLink></Hint>
          </Alert>
        )}
        {wallet && (
          <>
            <ConfirmButton type="button" onClick={() => void signIn(false)} disabled={busy} data-testid="wallet-signin">
              {busy ? t('op.sign.wallet.busy') : t('op.sign.wallet.button')}
            </ConfirmButton>
            {/* Offered only when the node says this caller could actually do it — from its own machine, or with
                the one-time token. Shown to anyone else it would be a button that always fails. */}
            {me?.canEnroll && (
              <EnrollRow>
                <WalletButton type="button" onClick={() => void signIn(true)} disabled={busy}>{t('op.sign.key.enroll')}</WalletButton>
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
