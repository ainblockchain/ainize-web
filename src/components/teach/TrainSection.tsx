import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import styled from 'styled-components';
import { useT } from '@/i18n';

const Navigation = styled.nav`
  width: 100%; max-width: ${(p) => p.theme.layout.maxWidth}; box-sizing: border-box;
  display: flex; flex-wrap: wrap; gap: 4px 16px; padding: 16px ${(p) => p.theme.layout.gutter} 0;
  a {
    padding: 10px 0; font-size: 14px; text-decoration: none; color: ${(p) => p.theme.color.GREY};
    border-bottom: 2px solid transparent;
    &[aria-current='page'] { color: ${(p) => p.theme.color.PRIMARY}; border-color: currentColor; font-weight: 600; }
    &:hover { color: ${(p) => p.theme.color.PRIMARY}; }
  }
`;

/** Training, its published results, and the visitor's work share one section. */
export function TrainSection({ children }: { children: ReactNode }) {
  const { t } = useT();
  return <>
    <Navigation aria-label="Train" data-testid="train-navigation">
      <NavLink to="/train" end>{t('train.start')}</NavLink>
      <NavLink to="/train/knowledge">{t('train.knowledge')}</NavLink>
      <NavLink to="/train/mine">{t('train.mine')}</NavLink>
    </Navigation>
    {children}
  </>;
}
