import styled from 'styled-components';

/**
 * Wordmark. Same silhouette family as the Ainize asset-logo (rounded glyph + wordmark) but for the
 * knowledge market: a small "row" glyph (three table rows with one highlighted patched row).
 */
const Wrap = styled.span<{ $light?: boolean; $size: number }>`
  display: inline-flex;
  align-items: center;
  gap: ${(p) => Math.round(p.$size * 0.35)}px;
  font-family: ${(p) => p.theme.font.display};
  font-weight: 800;
  font-size: ${(p) => p.$size}px;
  letter-spacing: -0.01em;
  color: ${(p) => (p.$light ? '#ffffff' : p.theme.color.BLACK)};
  white-space: nowrap;
  line-height: 1;
`;

const Accent = styled.span`
  color: ${(p) => p.theme.color.PRIMARY};
`;

export function LogoGlyph({ size = 26, light = false }: { size?: number; light?: boolean }) {
  const bg = light ? '#ffffff' : '#8b3eeb';
  const fg = light ? '#8b3eeb' : '#ffffff';
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="8" fill={bg} />
      <rect x="7" y="8" width="18" height="3.5" rx="1.75" fill={fg} opacity="0.55" />
      <rect x="7" y="14.25" width="18" height="3.5" rx="1.75" fill={fg} />
      <circle cx="26.5" cy="16" r="3.2" fill={light ? '#8b3eeb' : '#78d9e9'} stroke={bg} strokeWidth="1.5" />
      <rect x="7" y="20.5" width="18" height="3.5" rx="1.75" fill={fg} opacity="0.55" />
    </svg>
  );
}

export function Logo({ size = 20, light = false, glyph = true }: { size?: number; light?: boolean; glyph?: boolean }) {
  return (
    <Wrap $light={light} $size={size} aria-label="Knowledge Market">
      {glyph && <LogoGlyph size={Math.round(size * 1.35)} light={light} />}
      <span>knowledge<Accent style={light ? { color: '#c9b8ff' } : undefined}>market</Accent></span>
    </Wrap>
  );
}
