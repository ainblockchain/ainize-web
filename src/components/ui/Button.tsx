import styled, { css, keyframes } from 'styled-components';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'outlined' | 'contained' | 'text';
type Color = 'primary' | 'secondary' | 'default';
type Size = 'small' | 'medium' | 'large';

const spin = keyframes`to { transform: rotate(360deg); }`;

const Spinner = styled.span`
  width: 14px; height: 14px; margin-right: 8px; border-radius: 50%;
  border: 2px solid currentColor; border-right-color: transparent;
  animation: ${spin} 0.8s linear infinite; display: inline-block; flex: none;
`;

const colorOf = (c: Color, theme: { color: Record<string, string> }) =>
  c === 'primary' ? theme.color.PRIMARY : c === 'secondary' ? theme.color.SECONDARY : theme.color.BLACK;

/** MUI-v4-like button matching ainize-web (outlined primary, textTransform none, 4px radius). */
export const StyledButton = styled.button<{ $variant: Variant; $color: Color; $size: Size; $full?: boolean }>`
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  min-width: 64px;
  padding: ${(p) => (p.$size === 'small' ? '3px 9px' : p.$size === 'large' ? '10px 22px' : '6px 16px')};
  font-size: ${(p) => (p.$size === 'small' ? '13px' : p.$size === 'large' ? '15px' : '14px')};
  font-weight: 500; line-height: 1.75; letter-spacing: 0.02em;
  border-radius: 4px; cursor: pointer; text-decoration: none; white-space: nowrap;
  transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
  width: ${(p) => (p.$full ? '100%' : 'auto')};
  ${(p) => {
    const c = colorOf(p.$color, p.theme);
    if (p.$variant === 'contained') return css`
      color: #fff; background: ${c}; border: 1px solid ${c};
      &:hover { background: ${p.$color === 'primary' ? p.theme.color.HOVER : c}; filter: ${p.$color === 'primary' ? 'none' : 'brightness(0.92)'}; }
    `;
    if (p.$variant === 'text') return css`
      color: ${c}; background: transparent; border: 1px solid transparent;
      &:hover { background: ${c}14; }
    `;
    return css`
      color: ${c}; background: transparent; border: 1px solid ${c}80;
      &:hover { border-color: ${c}; background: ${c}0f; }
    `;
  }}
  &:disabled { cursor: not-allowed; opacity: 0.45; }
`;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant; color?: Color; size?: Size; loading?: boolean; loadingText?: ReactNode; fullWidth?: boolean; children?: ReactNode;
}

export function Button({ variant = 'outlined', color = 'primary', size = 'medium', loading, loadingText, fullWidth, children, disabled, ...rest }: ButtonProps) {
  return (
    <StyledButton $variant={variant} $color={color} $size={size} $full={fullWidth} disabled={disabled || loading} {...rest}>
      {loading && <Spinner aria-hidden />}
      {loading && loadingText ? loadingText : children}
    </StyledButton>
  );
}
