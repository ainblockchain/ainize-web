import { useEffect, type ReactNode } from 'react';
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

export function ScrollToTop() {
  const { pathname } = useLocation();
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
  if (loading) return <Layout><CenterProgress /></Layout>;
  // A deliberate sign-out rests on the landing page; only an expired/missing session asks to sign in again (and remembers where to return).
  if (signingOut) return <Navigate to="/" replace />;
  if (!isSignedIn) return <Navigate to={`/signing?next=${encodeURIComponent(pathname)}`} replace />;
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
