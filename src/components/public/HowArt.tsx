/**
 * Finding 98 — the three "How it works" steps illustrated themselves with feature-testing.png, feature-k8s.png and
 * feature-deploy.png, assets carried over from the 2019 container-hosting Ainize: an autoscale glyph over "Verified",
 * a Kubernetes server rack over "Live test", and — worst — a struck-through dollar sign directly above "Payment is
 * automatic and the knowledge is in the model in seconds", which reads as "payment failed" or "free".
 *
 * These three draw the mechanism the steps describe, and nothing else:
 *   1. one knowledge file going to three independent verifier nodes, each stamping its own check;
 *   2. the same question answered either side of a before/after divider — wrong on the left, right on the right;
 *   3. one row swapped inside the serving model's table, with the undo arrow that takes it back out.
 *
 * They carry no text, so they need no translation, and they are `aria-hidden`: the numbered heading and the sentence
 * under each step are the content. Colours are the landing page's own literals (it ships a fixed light palette).
 */
const INK = '#3f3f45';
const MUTED = '#b6b6c0';
const ACCENT = '#8c6cff';
const ACCENT_SOFT = '#e4ddff';
const GOOD = '#44a45f';
const BAD = '#d96a6a';

const box = { fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg width="200" height="150" viewBox="0 0 200 150" role="presentation" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** Step 01 — a knowledge file reaches three independent nodes and each one stamps a check of its own. */
export function VerifiedArt() {
  return (
    <Frame>
      {/* the knowledge file */}
      <path d="M12 44h30l12 12v50a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V48a4 4 0 0 1 4-4Z" {...box} stroke={INK} />
      <path d="M42 44v12h12" {...box} stroke={INK} />
      <path d="M22 72h24M22 84h24M22 96h14" {...box} stroke={MUTED} />
      {/* it goes out to three nodes */}
      <path d="M62 75h20M82 75l-9-6M82 75l-9 6" {...box} stroke={ACCENT} strokeWidth={2.4} />
      <path d="M84 75h6v-42h14M90 75h14M84 75h6v42h14" {...box} stroke={ACCENT_SOFT} strokeWidth={2} />
      {[16, 62, 108].map((y) => (
        <g key={y}>
          <rect x="106" y={y} width="82" height="34" rx="8" {...box} stroke={INK} />
          <path d="M116 12h18M116 20h30" {...box} stroke={MUTED} transform={`translate(0 ${y - 2})`} />
          <path d="M162 18l5 6 10-13" {...box} stroke={GOOD} strokeWidth={2.6} transform={`translate(0 ${y - 2})`} />
        </g>
      ))}
    </Frame>
  );
}

/** Step 02 — the same question, answered before and after the knowledge is loaded, side by side. */
export function LiveTestArt() {
  return (
    <Frame>
      {/* one question, two answers */}
      <rect x="58" y="6" width="84" height="26" rx="13" {...box} stroke={INK} />
      <path d="M74 19h52" {...box} stroke={MUTED} />
      <path d="M100 32v14M100 46H30v10M100 46h70v10" {...box} stroke={MUTED} strokeDasharray="4 4" />
      {/* the divider between before and after */}
      <path d="M100 60v84" {...box} stroke={ACCENT_SOFT} strokeWidth={2} strokeDasharray="6 6" />
      {/* before: the bare model gets it wrong */}
      <path d="M8 60h76a6 6 0 0 1 6 6v46a6 6 0 0 1-6 6H30l-10 12v-12H8a6 6 0 0 1-6-6V66a6 6 0 0 1 6-6Z" {...box} stroke={MUTED} />
      <path d="M16 76h56M16 88h40" {...box} stroke={MUTED} />
      <path d="M58 96l14 14M72 96l-14 14" {...box} stroke={BAD} strokeWidth={2.6} />
      {/* after: with the knowledge loaded it gets it right */}
      <path d="M116 60h76a6 6 0 0 1 6 6v46a6 6 0 0 1-6 6h-22l-10 12v-12h-44a6 6 0 0 1-6-6V66a6 6 0 0 1 6-6Z" {...box} stroke={ACCENT} />
      <path d="M124 76h56M124 88h40" {...box} stroke={ACCENT} />
      <path d="M126 103l7 8 15-18" {...box} stroke={GOOD} strokeWidth={2.6} />
    </Frame>
  );
}

/** Step 03 — one row is swapped inside the running model's table, and the same arrow takes it back out. */
export function ApplyArt() {
  return (
    <Frame>
      {/* the running model, with its memory table inside */}
      <rect x="58" y="10" width="134" height="98" rx="12" {...box} stroke={INK} />
      <path d="M58 34h134" {...box} stroke={INK} />
      <circle cx="71" cy="22" r="3.5" fill={MUTED} />
      <circle cx="83" cy="22" r="3.5" fill={MUTED} />
      <path d="M70 46h110M70 82h110M70 98h110" {...box} stroke={MUTED} />
      {/* the one row this knowledge writes */}
      <rect x="66" y="54" width="118" height="20" rx="5" fill={ACCENT_SOFT} stroke={ACCENT} strokeWidth={2} />
      <path d="M76 64h32M118 64h56" {...box} stroke={ACCENT} />
      {/* in, with no restart — and straight back out again whenever you want */}
      <path d="M8 56h44M52 56l-9-6M52 56l-9 6" {...box} stroke={ACCENT} strokeWidth={2.4} />
      <path d="M52 76H8M8 76l9-6M8 76l9 6" {...box} stroke={MUTED} strokeWidth={2.4} />
    </Frame>
  );
}
