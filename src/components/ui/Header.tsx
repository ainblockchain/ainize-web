import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import styled from 'styled-components';
import { useAuth } from '@/auth/AuthContext';
import { useInfoQuery } from '@/api/api';
import { useLocale, useT } from '@/i18n';
import { shortAddr } from '@/utils/format';

/** Ported from ainize-web components/ui/Header.js — white bar, 81px, subtle shadow, purple hover; original Ainize logo. */
const Wrapper = styled.header`
  width: 100%; display: flex; flex-direction: column; align-items: center;
  box-shadow: 0 0 20px 0 rgba(0, 0, 0, 0.1); background-color: #ffffff; z-index: 5; position: relative;
`;
/**
 * Desktop: one 81 px row (logo left, nav right). Phones (≤ breakpoint.sm): the nav wraps under the logo and its items
 * wrap onto as many lines as they need, so the page is never wider than the viewport (the review measured a 607–927 px
 * layout viewport at 360 px before this).
 */
const Content = styled.div`
  width: calc(100% - 32px); min-height: 81px; display: flex; flex-direction: row; align-items: center; flex-wrap: wrap;
  @media (min-width: ${(p) => p.theme.layout.maxWidth}) { width: ${(p) => p.theme.layout.maxWidth}; }
`;
/**
 * `flex: 0 0 auto` — Home holds a 121 px logo and a `white-space: nowrap` ledger badge, neither of which can shrink.
 * While it was `flex: 1; min-width: 0` the box was smaller than its content at every desktop width and the badge
 * spilled 65 px over the first nav link ("AI N[Explore knowledge]"). Nav takes the slack instead.
 */
const Home = styled(Link)`
  flex: 0 0 auto; order: 0; text-decoration: none; display: flex; align-items: center; gap: 10px;
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { flex: 1 1 auto; padding: 12px 0 2px; }
`;
const Logo = styled.img`width: 121px; object-fit: contain;`;
/** Takes the whole slack and right-aligns inside it, so the row's spare width lives between the logo and the links. */
const Nav = styled.nav`
  flex: 1 1 auto; order: 1; display: flex; flex-direction: row; align-items: center; flex-wrap: wrap; justify-content: flex-end; min-width: 0;
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { order: 2; flex: 1 0 100%; justify-content: flex-start; padding: 0 0 8px; margin-left: -8px; }
`;
/**
 * 10 px of horizontal padding, not 16. Home (121 px logo + 75 px badge, neither shrinkable) and the seven English
 * nav labels wanted 1,005 px inside a 944 px bar, and the 61 px deficit is what used to be paid for by painting
 * the badge over the first link. At 10 px the row needs 715 px of the 738 px it has and everything fits on one
 * 81 px line; when it still cannot (a signed-in operator, a 900 px window) the bar wraps cleanly instead.
 */
const navItemCss = `display: flex; align-items: center; height: 100%; padding: 16px 10px; font-size: 16px; font-weight: 500; text-decoration: none; white-space: nowrap;`;
const NavItem = styled(NavLink)`
  ${navItemCss} color: ${(p) => p.theme.color.BLACK};
  &:hover, &.active { color: ${(p) => p.theme.color.HOVER}; }
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { padding: 8px 8px; font-size: 14px; }
`;
/** Same look as NavItem but never "active" (it points at /chat?teach=1, which would otherwise light up together with Live test). */
const NavPlain = styled(Link)`
  ${navItemCss} color: ${(p) => p.theme.color.BLACK};
  &:hover { color: ${(p) => p.theme.color.HOVER}; }
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { padding: 8px 8px; font-size: 14px; }
`;
const UserMenuButton = styled.button`
  padding: 16px 12px 16px 20px; border: 0; background: transparent; font-size: 16px; color: ${(p) => p.theme.color.BLACK}; cursor: pointer; white-space: nowrap;
  &:hover { color: ${(p) => p.theme.color.HOVER}; }
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { padding: 8px 8px; font-size: 14px; }
`;
const Menu = styled.div<{ $open: boolean }>`
  position: absolute; right: 0; top: 100%; min-width: 220px; padding: 4px; background: #fff; border-radius: 4px;
  box-shadow: 0 5px 5px -3px rgba(0,0,0,.2), 0 8px 10px 1px rgba(0,0,0,.14), 0 3px 14px 2px rgba(0,0,0,.12);
  display: ${(p) => (p.$open ? 'block' : 'none')}; z-index: 10;
`;
const MenuItem = styled.button`
  display: block; width: 100%; padding: 12px; border: 0; background: transparent; text-align: left; font-size: 14px; line-height: 1; cursor: pointer; border-radius: 3px;
  &:hover { background: #f5eefc; }
`;
const MenuInfo = styled.div`padding: 10px 12px; font-size: 12px; color: ${(p) => p.theme.color.GREY}; border-bottom: 1px solid #f0f0f0; font-family: ${(p) => p.theme.font.mono};`;
const DevBadge = styled.div`
  position: fixed; left: 16px; top: 16px; padding: 8px 12px; font-size: 12px; color: #fff; background: ${(p) => p.theme.color.BLACK}; border-radius: 16px; box-shadow: rgba(0,0,0,0.5) 0 0 10px 0; z-index: 20;
`;
const LedgerBadge = styled.span<{ $ain: boolean }>`
  padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; white-space: nowrap;
  color: ${(p) => (p.$ain ? '#0b5468' : '#5b1ca8')}; background: ${(p) => (p.$ain ? '#e1eef3' : '#f5eefc')};
`;
/**
 * The language toggle is a system setting, not a navigation item (ux-critique-owner O-8): it is the header's last
 * child, outside the nav, in the top-right corner at every width. On a phone the nav wraps under the logo (order 2)
 * and the toggle stays on the logo row (order 1) — the DOM order home → nav → language never changes, so neither
 * does the Tab order. The same corner holds the same toggle on the landing page and in the teach flow's slim header.
 */
const LocaleButton = styled.button`
  flex: 0 0 auto; order: 2; margin-left: 12px; padding: 4px 8px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 12px; background: #fff; font-size: 12px; color: ${(p) => p.theme.color.GREY}; cursor: pointer;
  &:hover { color: ${(p) => p.theme.color.HOVER}; border-color: ${(p) => p.theme.color.HOVER}; }
  &:focus-visible { outline: 3px solid ${(p) => p.theme.color.PRIMARY}; outline-offset: 1px; }
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { order: 1; margin-left: auto; }
`;

export function Header() {
  const { isSignedIn, name, address, signOut } = useAuth();
  const { data: info } = useInfoQuery(undefined, { pollingInterval: 30_000 });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { t, help } = useT();
  const { locale, setLocale } = useLocale();
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const ain = info?.ledger.kind === 'ain';
  return (
    <Wrapper>
      {import.meta.env.DEV && <DevBadge>Development Mode</DevBadge>}
      <Content>
        <Home to="/" aria-label="Ainize home" title={help('brand')}>
          <Logo src="/static/images/asset-logo.png" srcSet="/static/images/asset-logo@2x.png 2x, /static/images/asset-logo@3x.png 3x" alt="Ainize" />
          {info && <LedgerBadge $ain={ain} title={`${help('ledger')} · ${ain ? t('nav.ledger_ain', { provider: info.ledger.provider ?? '' }) : t('nav.ledger_local')}`}>{ain ? 'AI Network' : 'P2P'}</LedgerBadge>}
        </Home>
        <Nav>
          <NavItem to="/explore">{t('nav.explore')}</NavItem>
          <NavItem to="/chat">{t('nav.chat')}</NavItem>
          {/* v2: the header leads to the entry choice (both doors); the landing CTA still leads straight to the chat door */}
          {info?.accepts_contributions && <NavPlain to="/teach" data-testid="nav-teach">{t('nav.teach')}</NavPlain>}
          <NavItem to="/network">{t('nav.network')}</NavItem>
          <NavItem to="/ledger">{t('nav.ledger')}</NavItem>
          <NavItem to="/docs">{t('nav.docs')}</NavItem>
          {isSignedIn && <NavItem to="/dashboard">{t('nav.dashboard')}</NavItem>}
          {!isSignedIn && <NavItem to="/signing">{t('nav.signin')}</NavItem>}
          {isSignedIn && (
            <div ref={ref} style={{ position: 'relative' }}>
              <UserMenuButton onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>{name ?? 'operator'} ▾</UserMenuButton>
              <Menu $open={open} role="menu">
                <MenuInfo title={address ?? ''}>{shortAddr(address, 8)}</MenuInfo>
                <MenuItem role="menuitem" onClick={() => { setOpen(false); navigate('/new-patch'); }}>{t('nav.register')}</MenuItem>
                <MenuItem role="menuitem" onClick={() => { setOpen(false); navigate('/account'); }}>{t('nav.account')}</MenuItem>
                <MenuItem role="menuitem" onClick={() => { setOpen(false); navigate('/drive'); }}>{t('nav.files')}</MenuItem>
                <MenuItem role="menuitem" onClick={() => {
                  setOpen(false);
                  // signOut() flips isSignedIn to false synchronously and navigate('/') lands in the same render, so neither the landing guard (→ /dashboard) nor the dashboard guard (→ /signing) fires.
                  // flushSync: commit the location change now instead of in a transition — otherwise a cold-cache landing chunk keeps the /dashboard guard mounted until the sign-out settles.
                  void signOut();
                  navigate('/', { flushSync: true });
                }}>{t('nav.logout')}</MenuItem>
              </Menu>
            </div>
          )}
        </Nav>
        <LocaleButton onClick={() => setLocale(locale === 'ko' ? 'en' : 'ko')} aria-label="language">{t('common.locale')}</LocaleButton>
      </Content>
    </Wrapper>
  );
}
