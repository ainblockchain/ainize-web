import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import styled from 'styled-components';
import { useAuth } from '@/auth/AuthContext';
import { Banner } from '@/components/ui/Banner';
import { FocusedHeader } from '@/components/ui/FocusedHeader';
import { Footer } from '@/components/ui/Footer';
import { Header } from '@/components/ui/Header';
import { CenterProgress } from '@/components/ui/Misc';
import { useT } from '@/i18n';

/** ainize-web base/Layout.js: header + centered content column + footer. */
const Wrapper = styled.div`
  width: 100%; min-height: 100%; margin: 0 auto; display: flex; flex-direction: column; align-items: center;
`;
const Content = styled.main`
  width: 100%; flex: 1; display: flex; flex-direction: column; align-items: center;
`;

/**
 * Every route change (push, Back and Forward alike) starts at the top of the page.
 * Chrome re-applies a history entry's saved scroll offset as soon as the freshly rendered page grows tall enough,
 * which happened after this effect had already run (data arrives → the list grows → the browser jumps back down).
 * Taking over scroll restoration makes the effect the only thing that positions the page.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'; }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { t } = useT();
  return (
    <Wrapper>
      <ScrollToTop />
      {pathname === '/dashboard' && (
        <Banner title={t('banner.p2p')} buttonTitle={t('banner.guide')} buttonHref="/network" secondaryTitle={t('banner.new')} secondaryHref="https://github.com/ainblockchain/ain-js" />
      )}
      <Header />
      <Content>{children}</Content>
      <Footer />
    </Wrapper>
  );
}

/**
 * The teach flow's chrome (`/teach/*`, ux-critique-owner O-3): a slim header (logo · exit · language) and a minimal
 * footer, so the one task on these pages — teaching the model — is not competing with seven marketplace links and
 * the developer footer. Marketplace pages keep `Layout`.
 */
export function FocusedLayout({ children }: { children: ReactNode }) {
  return (
    <Wrapper data-testid="focused-layout">
      <ScrollToTop />
      <FocusedHeader />
      <Content>{children}</Content>
      <Footer minimal />
    </Wrapper>
  );
}

/**
 * The screens for whoever RUNS this node, and the two different ways you can fail to be them.
 *
 * Not signed in is a redirect: there is something to do about it, and where to return to afterwards. Signed in
 * and not the owner is not — it must never redirect, because /signing would send a signed-in person straight
 * back here and the two would trade the tab for ever. It is also not really an error: connecting a wallet to a
 * node you do not run is the ordinary case, so it is answered with a sentence saying what still works.
 */
/**
 * Signed in is enough.
 *
 * `SigningCheckLayout` also requires owning THIS node, which is right for the screens that run it — operators,
 * settings, runtime, the node's wallet. It was the only signed-in gate there was, so every page behind a session
 * inherited "and you must run this node too", and a visitor who merely has an account was answered "this node is
 * not yours" on pages that were about them.
 *
 * The two are different questions and now have different gates. A page belongs here when its content is the
 * caller's: their keys, their record, the nodes they run somewhere else.
 */
export function SignedInLayout({ children }: { children: ReactNode }) {
  const { isSignedIn, loading, signingOut } = useAuth();
  const { pathname } = useLocation();
  const [sawSignOut, setSawSignOut] = useState(false);
  useEffect(() => { if (signingOut) setSawSignOut(true); }, [signingOut]);
  if (loading) return <Layout><CenterProgress /></Layout>;
  // A deliberate sign-out rests on the landing page; only an expired session asks to sign in again, and
  // remembers where to come back to. Same rule as the operator gate, for the same reason.
  if (signingOut || (sawSignOut && !isSignedIn)) return <Navigate to="/" replace />;
  if (!isSignedIn) return <Navigate to={`/signing?next=${encodeURIComponent(pathname)}`} replace />;
  return <Layout>{children}</Layout>;
}

export function SigningCheckLayout({ children }: { children: ReactNode }) {
  const { isSignedIn, isOwner, loading, signingOut } = useAuth();
  const { pathname } = useLocation();
  // Remember that this guard witnessed a deliberate sign-out. react-router wraps navigate('/') in a transition, so on a cold cache
  // (landing chunk still downloading) this guard is still mounted when /api/auth/me settles to signed-out — it must rest on /, not /signing?next=.
  const [sawSignOut, setSawSignOut] = useState(false);
  useEffect(() => { if (signingOut) setSawSignOut(true); }, [signingOut]);
  if (loading) return <Layout><CenterProgress /></Layout>;
  // A deliberate sign-out rests on the landing page; only an expired/missing session asks to sign in again (and remembers where to return).
  if (signingOut || (sawSignOut && !isSignedIn)) return <Navigate to="/" replace />;
  if (!isSignedIn) return <Navigate to={`/signing?next=${encodeURIComponent(pathname)}`} replace />;
  if (!isOwner) return <Layout><NotYourNode /></Layout>;
  return <Layout>{children}</Layout>;
}

const NotYours = styled.div`
  width: 100%; max-width: 660px; margin: 72px auto; padding: 0 20px;
  h1 { margin: 0 0 12px; font-size: 24px; font-weight: 600; }
  p { margin: 0 0 10px; font-size: 14.5px; line-height: 1.8; color: #666; word-break: keep-all; }
`;
const Ways = styled.div`
  margin-top: 28px; display: flex; flex-direction: column; gap: 10px;
`;
const Way = styled(Link)`
  display: block; padding: 16px 18px; border: 1px solid #e5e5e8; border-radius: 8px; text-decoration: none;
  background: #fff; transition: border-color .15s ease, background .15s ease;
  &:hover { border-color: ${(p) => p.theme.color.PRIMARY}; background: ${(p) => p.theme.color.PALE_GREY}; }
  strong { display: block; font-size: 15px; font-weight: 600; color: ${(p) => p.theme.color.PRIMARY}; }
  span { display: block; margin-top: 5px; font-size: 13px; line-height: 1.7; color: #777; word-break: keep-all; }
`;

/**
 * What a person who does not run this node is shown instead.
 *
 * This was a dead end, and worse than a dead end: it printed `ainize operators add <their address>` — a command
 * that needs a shell on somebody else's machine, and which, if they somehow ran it, would make them an owner of a
 * node that is not theirs. It told a visitor their own wallet was the wrong kind of thing, twice.
 *
 * What a person here actually wants is one of two things, so those are the things offered: keep using this node,
 * where everything that matters to them is open — testing knowledge, teaching it, being paid for it — or run a
 * node of their own, which is where these screens do open. The setup guide is a link, not a command to copy.
 */
function NotYourNode() {
  const { t, locale } = useT();
  const { subject, google, name } = useAuth();
  const short = subject ? `${subject.slice(0, 10)}…${subject.slice(-4)}` : google?.email ?? '';
  const setup = locale === 'ko' ? '/docs/ko/get-started/quickstart' : '/docs/get-started/quickstart';
  return (
    <NotYours data-testid="not-owner">
      <h1>{t('op.sign.not_owner.title')}</h1>
      <p>{t('op.sign.not_owner.body', { addr: short, node: name ?? '' })}</p>
      <Ways>
        {/* First, because it is the thing the product is for and it needs nothing from them at all. */}
        <Way to="/chat" data-testid="not-owner-chat">
          <strong>{t('op.sign.not_owner.try')} →</strong>
          <span>{t('op.sign.not_owner.try_hint')}</span>
        </Way>
        <Way to="/explore" data-testid="not-owner-explore">
          <strong>{t('op.sign.not_owner.explore')} →</strong>
        </Way>
        <Way to="/teach" data-testid="not-owner-teach">
          <strong>{t('op.sign.not_owner.teach')} →</strong>
          <span>{t('op.sign.not_owner.teach_hint')}</span>
        </Way>
        <Way to={setup} data-testid="not-owner-setup">
          <strong>{t('op.sign.not_owner.own')} →</strong>
          <span>{t('op.sign.not_owner.own_hint')}</span>
        </Way>
      </Ways>
    </NotYours>
  );
}

/**
 * /new-patch (spec §5.2 / §11): signed-out visitors get the public two-way pre-screen (teach in chat vs. sign in and upload a file)
 * instead of being bounced to the sign-in wall; operators see the form as before.
 */
const NewPatchPreScreen = lazy(() => import('@/components/operator/NewPatchPreScreen'));
export function NewPatchGate({ children }: { children: ReactNode }) {
  const { isOwner, loading } = useAuth();
  // `isOwner`, not `isSignedIn`: uploading a file straight into this node's catalogue is the node runner's
  // privilege, and the node refuses it from anyone else. A visitor with a connected wallet sees the pre-screen —
  // which offers the door that IS open to them, teaching in chat — rather than a form that would 403.
  if (loading) return <Layout><CenterProgress /></Layout>;
  if (!isOwner) return <Layout><Suspense fallback={<CenterProgress />}><NewPatchPreScreen /></Suspense></Layout>;
  return <Layout>{children}</Layout>;
}

/** ainize-web base/FullScreenLayout.js: dark full-bleed landing; signed-in operators go straight to the dashboard. */
const FullWrapper = styled.div`
  width: 100%; min-height: 100%; display: flex; flex-direction: column; align-items: center; background-color: #333333;
`;
export function FullScreenLayout({ children }: { children: ReactNode }) {
  const { isOwner, loading } = useAuth();
  // Only the node's own runner is sent past the landing page. Somebody who connected a wallet to read the
  // catalogue is a visitor, and bouncing them to a dashboard they cannot open would be the old assumption —
  // "signed in means this is your node" — in the one place it is most visible.
  if (!loading && isOwner) return <Navigate to="/dashboard" replace />;
  return <FullWrapper>{children}</FullWrapper>;
}
