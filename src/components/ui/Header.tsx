import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import styled from 'styled-components';
import { useAuth } from '@/auth/AuthContext';
import { useLogoutMutation, useInfoQuery } from '@/api/api';
import { Logo } from './Logo';
import { shortAddr } from '@/utils/format';

/** Ported from ainize-web components/ui/Header.js — white bar, 81px, subtle shadow, purple hover. */
const Wrapper = styled.header`
  width: 100%; display: flex; flex-direction: column; align-items: center;
  box-shadow: 0 0 20px 0 rgba(0, 0, 0, 0.1); background-color: #ffffff; z-index: 5; position: relative;
`;
const Content = styled.div`
  width: calc(100% - 32px); height: 81px; display: flex; flex-direction: row; align-items: center;
  @media (min-width: ${(p) => p.theme.layout.maxWidth}) { width: ${(p) => p.theme.layout.maxWidth}; }
`;
const Home = styled(Link)`flex: 1; text-decoration: none; display: flex; align-items: center;`;
const Nav = styled.nav`display: flex; flex-direction: row; align-items: center;`;
const NavItem = styled(NavLink)`
  display: flex; align-items: center; height: 100%; padding: 16px 20px; font-size: 16px; font-weight: 500; color: ${(p) => p.theme.color.BLACK}; text-decoration: none;
  &:hover, &.active { color: ${(p) => p.theme.color.HOVER}; }
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { padding: 16px 10px; font-size: 14px; }
`;
const UserMenuButton = styled.button`
  padding: 16px 20px; border: 0; background: transparent; font-size: 16px; color: ${(p) => p.theme.color.BLACK}; cursor: pointer;
  &:hover { color: ${(p) => p.theme.color.HOVER}; }
`;
const Menu = styled.div<{ $open: boolean }>`
  position: absolute; right: 0; top: 100%; min-width: 200px; padding: 4px; background: #fff; border-radius: 4px;
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
  margin-left: 8px; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em;
  color: ${(p) => (p.$ain ? '#0b5468' : '#5b1ca8')}; background: ${(p) => (p.$ain ? '#e1eef3' : '#f5eefc')};
`;

export function Header() {
  const { isSignedIn, name, address } = useAuth();
  const { data: info } = useInfoQuery(undefined, { pollingInterval: 30_000 });
  const [logout] = useLogoutMutation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
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
        <Home to="/" aria-label="Home"><Logo size={18} />{info && <LedgerBadge $ain={ain} title={ain ? `AIN blockchain ledger · ${info.ledger.provider}` : 'local P2P ledger'}>{ain ? 'AIN' : 'LOCAL'}</LedgerBadge>}</Home>
        <Nav>
          <NavItem to="/explore">Explore</NavItem>
          <NavItem to="/network">Network</NavItem>
          <NavItem to="/ledger">Ledger</NavItem>
          {isSignedIn && <NavItem to="/dashboard">Dashboard</NavItem>}
          {!isSignedIn && <NavItem to="/signing">Sign in</NavItem>}
          {isSignedIn && (
            <div ref={ref} style={{ position: 'relative' }}>
              <UserMenuButton onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>{name ?? 'operator'} ▾</UserMenuButton>
              <Menu $open={open} role="menu">
                <MenuInfo title={address ?? ''}>{shortAddr(address, 8)}</MenuInfo>
                <MenuItem role="menuitem" onClick={() => { setOpen(false); navigate('/account'); }}>Account settings</MenuItem>
                <MenuItem role="menuitem" onClick={() => { setOpen(false); navigate('/drive'); }}>Files &amp; changes</MenuItem>
                <MenuItem role="menuitem" onClick={async () => { setOpen(false); await logout(); navigate('/'); }}>Logout</MenuItem>
              </Menu>
            </div>
          )}
        </Nav>
      </Content>
    </Wrapper>
  );
}
