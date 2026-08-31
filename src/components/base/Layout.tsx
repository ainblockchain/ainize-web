import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import styled from 'styled-components';
import { useAuth } from '@/auth/AuthContext';
import { Banner } from '@/components/ui/Banner';
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

/** ainize-web base/SigningCheckLayout.js: redirect to sign-in when the operator is not logged in. */
export function SigningCheckLayout({ children }: { children: ReactNode }) {
  const { isSignedIn, loading, signingOut } = useAuth();
  const { pathname } = useLocation();
  // Remember that this guard witnessed a deliberate sign-out. react-router wraps navigate('/') in a transition, so on a cold cache
  // (landing chunk still downloading) this guard is still mounted when /api/auth/me settles to signed-out — it must rest on /, not /signing?next=.
  const [sawSignOut, setSawSignOut] = useState(false);
  useEffect(() => { if (signingOut) setSawSignOut(true); }, [signingOut]);
  if (loading) return <Layout><CenterProgress /></Layout>;
  // A deliberate sign-out rests on the landing page; only an expired/missing session asks to sign in again (and remembers where to return).
  if (signingOut || (sawSignOut && !isSignedIn)) return <Navigate to="/" replace />;
  if (!isSignedIn) return <Navigate to={`/signing?next=${encodeURIComponent(pathname)}`} replace />;
  return <Layout>{children}</Layout>;
}

/**
 * /new-patch (spec §5.2 / §11): signed-out visitors get the public two-way pre-screen (teach in chat vs. sign in and upload a file)
 * instead of being bounced to the sign-in wall; operators see the form as before.
 */
const NewPatchPreScreen = lazy(() => import('@/components/operator/NewPatchPreScreen'));
export function NewPatchGate({ children }: { children: ReactNode }) {
  const { isSignedIn, loading } = useAuth();
  if (loading) return <Layout><CenterProgress /></Layout>;
  if (!isSignedIn) return <Layout><Suspense fallback={<CenterProgress />}><NewPatchPreScreen /></Suspense></Layout>;
  return <Layout>{children}</Layout>;
}

/** ainize-web base/FullScreenLayout.js: dark full-bleed landing; signed-in operators go straight to the dashboard. */
const FullWrapper = styled.div`
  width: 100%; min-height: 100%; display: flex; flex-direction: column; align-items: center; background-color: #333333;
`;
export function FullScreenLayout({ children }: { children: ReactNode }) {
  const { isSignedIn, loading } = useAuth();
  if (!loading && isSignedIn) return <Navigate to="/dashboard" replace />;
  return <FullWrapper>{children}</FullWrapper>;
}
