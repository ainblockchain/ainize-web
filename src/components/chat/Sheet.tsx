import { useEffect, type ReactNode } from 'react';
import styled from 'styled-components';
import { useT } from '@/i18n';

/**
 * Minimal modal sheet / side drawer (no dependency): backdrop, Escape to close, aria-modal. Used by the teach drawer,
 * the credit / preflight / publish / keep-private sheets and the Your-knowledge panel.
 */
const Backdrop = styled.div`
  position: fixed; inset: 0; z-index: 40; background: rgba(48, 49, 51, 0.45); display: flex; justify-content: center; align-items: flex-start; padding: 48px 16px; overflow-y: auto;
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { padding: 16px 8px; }
`;
const Panel = styled.section<{ $side?: boolean; $width: number }>`
  width: 100%; max-width: ${(p) => p.$width}px; background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 6px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18); display: flex; flex-direction: column; max-height: calc(100vh - 64px);
  ${(p) => p.$side && `margin-left: auto; margin-right: 0; margin-top: -32px; min-height: calc(100vh - 32px); border-radius: 6px 0 0 6px;`}
`;
const Head = styled.header`
  display: flex; align-items: flex-start; gap: 12px; padding: 20px 24px 12px; border-bottom: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
  h2 { margin: 0; font-size: 18px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; }
  p { margin: 6px 0 0; font-size: 13px; line-height: 1.5; color: ${(p) => p.theme.color.GREY}; }
`;
const CloseBtn = styled.button`
  margin-left: auto; flex: none; width: 32px; height: 32px; border: 0; border-radius: 16px; background: transparent; font-size: 20px; line-height: 1; color: ${(p) => p.theme.color.GREY}; cursor: pointer;
  &:hover { background: ${(p) => p.theme.color.PALE_GREY}; color: ${(p) => p.theme.color.BLACK}; }
`;
const Body = styled.div`padding: 16px 24px 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; font-size: 14px; line-height: 1.55; color: ${(p) => p.theme.color.BLACK};`;
export const SheetFooter = styled.div`display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: flex-end; padding-top: 4px;`;
export const SheetNote = styled.p`margin: 0; font-size: 12px; line-height: 1.5; color: ${(p) => p.theme.color.GREY};`;

export interface SheetProps {
  title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode; side?: boolean; width?: number; testId?: string;
}

export function Sheet({ title, sub, onClose, children, side, width = 560, testId }: SheetProps) {
  const { t } = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <Backdrop onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <Panel role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} $side={side} $width={width} data-testid={testId}>
        <Head>
          <div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
          <CloseBtn type="button" onClick={onClose} aria-label={t('teach.drawer.close')}>×</CloseBtn>
        </Head>
        <Body>{children}</Body>
      </Panel>
    </Backdrop>
  );
}
