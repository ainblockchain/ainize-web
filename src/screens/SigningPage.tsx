import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import styled from 'styled-components';
import { errorMessage, useEnrollMutation, useLoginChallengeMutation, useLoginWalletMutation, useMeQuery, useSsoConnectMutation, useSsoStatusQuery } from '@/api/api';
import { connect, discoverWallets, personalSign, WalletError, type DiscoveredWallet } from '@/lib/ethWallet';
import { useAuth } from '@/auth/AuthContext';
import { useT } from '@/i18n';
import { servedOutsideApp } from '@/lib/nextNavigation';
import { useTitle } from '@/utils/useTitle';
import { Alert } from '@/components/ui/Form';
import { PageWrapper, Title } from '@/components/ui/Misc';

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
const Fine = styled.p`margin: 24px 0 0; font-size: 12.5px; color: ${(p) => p.theme.color.GREY};`;
const WalletButton = styled.button`
  min-width: 196px; height: 44px; padding: 0 16px; border: 1px solid ${(p) => p.theme.color.PRIMARY}; border-radius: 4px; background: #fff;
  color: ${(p) => p.theme.color.PRIMARY}; font-size: 15px; font-weight: 500; cursor: pointer; text-align: left;
  display: inline-flex; align-items: center; gap: 10px;
  &:hover { background: ${(p) => p.theme.color.PALE_GREY}; } &:disabled { opacity: .55; cursor: not-allowed; }
  img { width: 20px; height: 20px; border-radius: 4px; }
`;
const WalletList = styled.div`margin-top: 32px; display: flex; flex-direction: column; gap: 10px; align-items: flex-start;`;
const GoogleButton = styled.a`
  min-width: 196px; height: 44px; padding: 0 16px; border: 1px solid #dadce0; border-radius: 4px; background: #fff;
  color: #3c4043; font-size: 15px; font-weight: 500; text-decoration: none;
  display: inline-flex; align-items: center; gap: 10px;
  &:hover { background: #f8f9fa; }
  svg { width: 18px; height: 18px; flex: none; }
`;
const Or = styled.p`margin: 24px 0 0; font-size: 13px; color: ${(p) => p.theme.color.GREY};`;
/** AIN SSO's door: the same shape as Google's, in the brand colour, because it is this company's own account. */
const SsoButton = styled.a`
  min-width: 196px; height: 44px; padding: 0 16px; border: 1px solid ${(p) => p.theme.color.PRIMARY}; border-radius: 4px; background: ${(p) => p.theme.color.PRIMARY};
  color: #fff; font-size: 15px; font-weight: 500; text-decoration: none;
  display: inline-flex; align-items: center; gap: 10px;
  &:hover { background: ${(p) => p.theme.color.HOVER}; }
`;
/** Sign-up at AIN SSO: a quieter door under the AIN button — the same account, asked for the first time. */
const SsoCreate = styled.a`
  display: inline-block; margin-top: 12px; font-size: 14px; font-weight: 500; color: ${(p) => p.theme.color.PRIMARY}; text-decoration: none;
  &:hover { border-bottom: 1px solid #8b3eeb; }
`;
const ConnectPanel = styled.div`margin-top: 32px; padding: 18px; border: 1px solid #e2e4ea; border-radius: 10px; display: flex; flex-direction: column; gap: 12px; align-items: flex-start;`;
const ConnectTitle = styled.p`margin: 0; font-size: 16px; font-weight: 600; color: ${(p) => p.theme.color.BLACK};`;

/** Google's four-colour "G", inline so the button needs no asset and no request to Google before it is pressed. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function SigningPage() {
  const { t, locale } = useT();
  useTitle(t('nav.signin'));
  const auth = useAuth();
  const { data: me } = useMeQuery();
  const [params] = useSearchParams();
  const routerNavigate = useNavigate();
  // `next` may be a path this app does not render (ainize.ai/code); those need a real page load, not a route change.
  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    if (servedOutsideApp(to)) {
      if (options?.replace) window.location.replace(to); else window.location.assign(to);
      return;
    }
    routerNavigate(to, options);
  }, [routerNavigate]);
  const requestedNext = params.get('next');
  const next = requestedNext?.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/my-nodes';
  /**
   * The one-time enrolment token, handed over in the link.
   *
   * A node with no owners yet cannot be claimed from a browser: the node accepts an enrolment from its own
   * machine, or from whoever holds the token written in its home directory — which is how an operator invites
   * a wallet that is not on the box. The token is read from the URL and never stored; it is consumed by the
   * node on the first successful enrolment, so the link works exactly once.
   */
  const setupToken = params.get('token') || undefined;
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

  // A wallet session is what sends you on. A Google-only one does not: it is the person this page must still be able
  // to offer a wallet to, and every guard that needs an address sends them here to get one.
  useEffect(() => { if (!auth.loading && auth.subject) navigate(next, { replace: true }); }, [auth.loading, auth.subject, navigate, next]);
  const googleError = params.get('google_error');
  // Not the /dashboard default: that screen is the node owner's, and a Google session can never own a node.
  const googleNext = params.get('next') || '/';

  /**
   * AIN SSO (src/lib/ainSso.ts). The button is offered only where the server can complete it. `?sso=connect` is where
   * the callback sends an AIN sign-in that has no ainize.ai account yet: the person may connect their existing
   * Google-based one — proven by being signed in to it in this browser, never by email — or start fresh.
   */
  const ssoError = params.get('sso_error');
  const connecting = params.get('sso') === 'connect';
  const { data: ssoStatus, refetch: refetchSso } = useSsoStatusQuery();
  const [ssoConnect, ssoConnectState] = useSsoConnectMutation();
  const [connectError, setConnectError] = useState<string | null>(null);
  const pending = connecting ? ssoStatus?.pending ?? null : null;
  const finishConnect = async (choice: 'legacy' | 'new') => {
    setConnectError(null);
    try {
      const r = await ssoConnect({ choice }).unwrap();
      await auth.refresh();
      navigate(r.next || '/', { replace: true });
    } catch (e) {
      const body = (e as { data?: { message?: string; error?: string } } | null)?.data;
      setConnectError(body?.message ?? body?.error ?? errorMessage(e));
      void refetchSso();
    }
  };
  // Back here from the old Google sign-in, the connect panel is waiting with the account it can now connect.
  const connectAgain = `/signing?sso=connect&next=${encodeURIComponent(pending?.next ?? googleNext)}`;

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
      await (alsoEnroll || setupToken
        ? enroll({ address, nonce: ch.nonce, signature, setupToken })
        : loginWallet({ address, nonce: ch.nonce, signature })).unwrap();
      await auth.refresh();
      navigate(next, { replace: true });
    } catch (e) {
      setLocalError(e instanceof WalletError ? t(`op.sign.wallet.err_${e.message}`) : signInError(e));
    } finally { setBusy(false); }
  };

  const loginDocs = locale === 'ko' ? '/docs/ko/how-to/connect-nodes' : '/docs/how-to/connect-nodes';
  const [agreeBefore, agreeAfter] = t('op.sign.agree', { terms: '|' }).split('|');

  return (
    <PageWrapper>
      <Title>{t('op.sign.login.title')}</Title>
      <Hint data-testid="sign-general">{t('op.sign.general')}</Hint>

      <OptionContainer>
        {wallets !== null && wallets.length === 0 && (
          <Alert $tone="info" data-testid="no-wallet">
            {t('op.sign.key.no_wallet')}
            <Hint>
              <Outbound href="https://metamask.io/download/" target="_blank" rel="noreferrer noopener">{t('op.sign.wallet.no_install')} →</Outbound>
              {' · '}
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
            {/* An invitation is not an ordinary sign-in and must not look like one: signing here makes this
                address an operator of the node, which is worth saying before the wallet prompt, not after. */}
            {setupToken && !me?.canEnroll && (
              <Alert $tone="info" role="status" style={{ marginTop: 12 }}>{t('op.sign.enroll_invite')}</Alert>
            )}
            {/* Offered only when the node says this caller could actually do it — from its own machine, or with the
                one-time token. Shown to anyone else it would be a button that always fails. */}
            {me?.canEnroll && (
              <EnrollRow>
                <WalletButton type="button" onClick={() => void signIn(wallets[0]!, true)} disabled={busy}>{t('op.sign.key.enroll')}</WalletButton>
              </EnrollRow>
            )}
          </>
        )}

        {/* The AIN sign-in waiting to be finished: connect the old account, or not. */}
        {connecting && pending && (
          <ConnectPanel data-testid="sso-connect">
            <ConnectTitle>{t('op.sign.sso.connect.title')}</ConnectTitle>
            <Hint style={{ marginTop: 0 }}>{t('op.sign.sso.connect.lede', { who: pending.email ?? pending.name ?? 'AIN' })}</Hint>
            {ssoStatus?.legacyGoogle && (
              <ConfirmButton type="button" style={{ marginTop: 0, width: 'auto', padding: '0 16px' }} disabled={ssoConnectState.isLoading} onClick={() => void finishConnect('legacy')} data-testid="sso-connect-legacy">
                {ssoConnectState.isLoading ? t('op.sign.sso.connect.busy') : t('op.sign.sso.connect.legacy', { email: ssoStatus.legacyGoogle.email })}
              </ConfirmButton>
            )}
            {!ssoStatus?.legacyGoogle && ssoStatus?.legacyGoogleAvailable && (
              <GoogleButton href={`/api/auth/google/start?next=${encodeURIComponent(connectAgain)}`} data-testid="sso-connect-google">
                <GoogleMark />{t('op.sign.sso.connect.google_first')}
              </GoogleButton>
            )}
            <WalletButton type="button" disabled={ssoConnectState.isLoading} onClick={() => void finishConnect('new')} data-testid="sso-connect-new">{t('op.sign.sso.connect.new')}</WalletButton>
            {connectError && <Alert $tone="error" role="alert">{connectError}</Alert>}
          </ConnectPanel>
        )}
        {connecting && ssoStatus && !pending && <Alert $tone="info" role="status" style={{ marginTop: 24 }}>{t('op.sign.sso.connect.expired')}</Alert>}

        {/* AIN SSO: another door beside Google's, never instead of the wallet. Offered only where configured. Under it,
            sign-up at AIN SSO (prompt=create) — this site has no sign-up of its own to keep beside it. */}
        {auth.ssoConfigured && !auth.sso && !pending && (
          <>
            {wallets && wallets.length > 0 && <Or>{t('op.sign.google.or')}</Or>}
            <SsoButton href={`/api/auth/sso/start?next=${encodeURIComponent(googleNext)}`} data-testid="sso-signin" style={{ marginTop: wallets && wallets.length > 0 ? 12 : 32 }}>
              {t('op.sign.sso.button')}
            </SsoButton>
            <div>
              <SsoCreate href={`/api/auth/sso/start?prompt=create&next=${encodeURIComponent(googleNext)}`} data-testid="sso-create" title={t('op.sign.sso.create_hint')}>
                {t('op.sign.sso.create')} →
              </SsoCreate>
            </div>
          </>
        )}
        {/* Once this site's own Google sign-in is switched off (LEGACY_LOGIN=false), the Google door goes through AIN SSO,
            straight to Google (ain_idp=google): the same account as everywhere else, not a separate one here. */}
        {auth.ssoConfigured && ssoStatus?.legacyLogin === 'false' && !auth.sso && !pending && (
          <GoogleButton href={`/api/auth/sso/start?idp=google&next=${encodeURIComponent(googleNext)}`} data-testid="sso-google" style={{ marginTop: 16 }}>
            <GoogleMark />{t('op.sign.sso.google')}
          </GoogleButton>
        )}
        {auth.sso && <Alert $tone="info" role="status" data-testid="sso-signed-in" style={{ marginTop: 24 }}>{t('op.sign.sso.signed_in', { who: auth.sso.email ?? auth.sso.name ?? auth.sso.sub })}</Alert>}
        {ssoError && <Alert $tone="error" role="alert" style={{ marginTop: 16 }}>{t('op.sign.sso.err', { reason: ssoError })}</Alert>}

        {/* Google is a separate door into this app, not into the node: a full-page redirect, because the consent
            screen is Google's page and cannot be fetched. Offered only when this server holds the credentials. */}
        {auth.googleConfigured && !auth.google && !pending && (
          <>
            {wallets && wallets.length > 0 && <Or>{t('op.sign.google.or')}</Or>}
            <GoogleButton href={`/api/auth/google/start?next=${encodeURIComponent(googleNext)}`} data-testid="google-signin" style={{ marginTop: wallets && wallets.length > 0 ? 12 : 32 }}>
              <GoogleMark />{t('op.sign.google.button')}
            </GoogleButton>
          </>
        )}
        {auth.google && <Alert $tone="info" role="status" data-testid="google-signed-in" style={{ marginTop: 24 }}>{t('op.sign.google.signed_in', { email: auth.google.email })}</Alert>}
        {googleError && <Alert $tone="error" role="alert" style={{ marginTop: 16 }}>{t('op.sign.google.err', { reason: googleError })}</Alert>}

        {localError && <Alert $tone="error" role="alert" style={{ marginTop: 16 }}>{localError}</Alert>}
        <Fine>
          {agreeBefore}<StyledLink to="/terms">{t('op.sign.terms')}</StyledLink>{agreeAfter}
          {' · '}<StyledLink to="/chat">{t('op.sign.visitor_cta')}</StyledLink>
        </Fine>
      </OptionContainer>
    </PageWrapper>
  );
}
