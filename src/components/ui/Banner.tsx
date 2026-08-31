import { useState } from 'react';
import styled from 'styled-components';
import { ArrowForwardIcon, BrandPattern, CloseIcon, StarIcon } from './Icons';

/** Ported from ainize-web Banner.js — purple band with the overlay pattern and two pill buttons. */
const Wrapper = styled.div`
  width: 100%; padding: 16px; background-color: ${(p) => p.theme.color.BANNER}; position: relative; overflow: hidden;
`;
const Pattern = styled.div`
  position: absolute; left: 0; top: 0; right: 0; bottom: 0; text-align: center; pointer-events: none;
  @media (min-width: ${(p) => p.theme.breakpoint.md}px) { left: -423px; top: -12px; }
`;
const Content = styled.div`
  max-width: ${(p) => p.theme.layout.maxWidth}; margin: auto; display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 24px; flex-wrap: wrap; position: relative;
`;
const Text = styled.div`font-family: ${(p) => p.theme.font.display}; font-weight: 700; font-size: 16px; color: #ffffff; text-align: center;`;
const Buttons = styled.div`display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 20px; flex-wrap: wrap;`;
const Pill = styled.a`
  display: inline-flex; align-items: center; gap: 8px; padding: 6px 24px; font-size: 16px; font-weight: 700; color: #ffffff; text-decoration: none;
  border: 1px solid rgba(255, 255, 255, 0.5); border-radius: 32px; background: transparent; cursor: pointer; transition: background 0.2s ease;
  &:hover { background: #7342ff; }
`;
const Close = styled.button`
  position: absolute; top: 12px; right: 16px; border: 0; background: transparent; cursor: pointer; padding: 4px;
`;

const KEY = 'km.showBanner';

export function Banner({ title, buttonTitle, buttonHref, secondaryTitle, secondaryHref, dismissible = true }: {
  title: string; buttonTitle: string; buttonHref: string; secondaryTitle?: string; secondaryHref?: string; dismissible?: boolean;
}) {
  const [show, setShow] = useState(() => { try { return localStorage.getItem(KEY) !== 'false'; } catch { return true; } });
  if (!show) return null;
  return (
    <Wrapper role="region" aria-label="announcement">
      <Pattern><BrandPattern /></Pattern>
      <Content>
        <Text>{title}</Text>
        <Buttons>
          <Pill href={buttonHref} target={buttonHref.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer"><ArrowForwardIcon />{buttonTitle}</Pill>
          {secondaryTitle && secondaryHref && <Pill href={secondaryHref} target="_blank" rel="noopener noreferrer"><StarIcon />{secondaryTitle}</Pill>}
        </Buttons>
      </Content>
      {dismissible && <Close aria-label="dismiss" onClick={() => { try { localStorage.setItem(KEY, 'false'); } catch { /* ignore */ } setShow(false); }}><CloseIcon /></Close>}
    </Wrapper>
  );
}
