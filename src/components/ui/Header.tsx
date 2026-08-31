import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import styled from 'styled-components';
import { useAuth } from '@/auth/AuthContext';
import { useLogoutMutation, useInfoQuery } from '@/api/api';
import { useLocale, useT } from '@/i18n';
import { shortAddr } from '@/utils/format';

/** Ported from ainize-web components/ui/Header.js — white bar, 81px, subtle shadow, purple hover; original Ainize logo. */
const Wrapper = styled.header`
  width: 100%; display: flex; flex-direction: column; align-items: center;
  box-shadow: 0 0 20px 0 rgba(0, 0, 0, 0.1); background-color: #ffffff; z-index: 5; position: relative;
`;
const Content = styled.div`
  width: calc(100% - 32px); height: 81px; display: flex; flex-direction: row; align-items: center;
  @media (min-width: ${(p) => p.theme.layout.maxWidth}) { width: ${(p) => p.theme.layout.maxWidth}; }
`;
const Home = styled(Link)`flex: 1; text-decoration: none; display: flex; align-items: center; gap: 10px;`;
const Logo = styled.img`width: 121px; object-fit: contain;`;
const Nav = styled.nav`display: flex; flex-direction: row; align-items: center;`;
const NavItem = styled(NavLink)`
  display: flex; align-items: center; height: 100%; padding: 16px 16px; font-size: 16px; font-weight: 500; color: ${(p) => p.theme.color.BLACK}; text-decoration: none; white-space: nowrap;
  &:hover, &.active { color: ${(p) => p.theme.color.HOVER}; }
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { padding: 16px 8px; font-size: 14px; }
`;
const UserMenuButton = styled.button`
  padding: 16px 12px 16px 20px; border: 0; background: transparent; font-size: 16px; color: ${(p) => p.theme.color.BLACK}; cursor: pointer; white-space: nowrap;
  &:hover { color: ${(p) => p.theme.color.HOVER}; }
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
const LocaleButton = styled.button`
  margin-left: 4px; padding: 4px 8px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 12px; background: #fff; font-size: 12px; color: ${(p) => p.theme.color.GREY}; cursor: pointer;
  &:hover { color: ${(p) => p.theme.color.HOVER}; border-color: ${(p) => p.theme.color.HOVER}; }
`;

export function Header() {
  const { isSignedIn, name, address } = useAuth();
  const { data: info } = useInfoQuery(undefined, { pollingInterval: 30_000 });
  const [logout] = useLogoutMutation();
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
          {info && <LedgerBadge $ain={ain} title={ain ? `${help('ledger')} · AI Network (${info.ledger.provider})` : `${help('ledger')} · ${locale === 'ko' ? '로컬 P2P 기록' : 'local P2P record'}`}>{ain ? 'AI Network' : 'P2P'}</LedgerBadge>}
        </Home>
        <Nav>
          <NavItem to="/explore">{t('nav.explore')}</NavItem>
          <NavItem to="/chat">{t('nav.chat')}</NavItem>
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
                <MenuItem role="menuitem" onClick={() => { setOpen(false); navigate('/account'); }}>{t('nav.account')}</MenuItem>
                <MenuItem role="menuitem" onClick={() => { setOpen(false); navigate('/drive'); }}>{t('nav.files')}</MenuItem>
                <MenuItem role="menuitem" onClick={async () => { setOpen(false); await logout(); navigate('/'); }}>{t('nav.logout')}</MenuItem>
              </Menu>
            </div>
          )}
          <LocaleButton onClick={() => setLocale(locale === 'ko' ? 'en' : 'ko')} aria-label="language">{t('common.locale')}</LocaleButton>
        </Nav>
      </Content>
    </Wrapper>
  );
}
