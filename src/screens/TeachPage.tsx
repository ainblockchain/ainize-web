import { Link } from 'react-router';
import styled from 'styled-components';
import { useTeachPolicyQuery } from '@/api/api';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { Alert } from '@/components/ui/Form';
import { Description, PageWrapper, Title, TitleRow } from '@/components/ui/Misc';
import { policyLine } from '@/components/chat/teachUtil';
import { STEP_KEYS } from '@/components/teach/Stepper';
import { readiness, rowsPerJob } from '@/components/teach/util';

/**
 * `/teach` — the entry choice (design §5.2, ux-critique-owner O-1). Two doors, one pipeline — and one of them leads.
 * The conversation door is primary: a newcomer needs no file, no preparation, and sees the value in one question
 * (ask, correct, the model learns it). The file door is for people who already have their questions and answers in
 * a file; it is one click away, styled as the clearly secondary alternative (smaller card, outlined button, an
 * "Already have a file?" eyebrow). When this node is not teaching, both CTAs are disabled and the node's own
 * sentence says why.
 */
const Doors = styled.div`
  display: grid; grid-template-columns: 1fr; gap: 16px; margin-top: 24px;
  @media (min-width: ${(p) => p.theme.breakpoint.sm}px) { grid-template-columns: 3fr 2fr; align-items: stretch; }
`;
/**
 * A door is ONE click target (ux-critique-owner O-9): the whole card is the link — both doors are navigations, so a
 * link is the honest element, it is reachable with Tab and fires on Enter, and a heading may live inside it — and the
 * "button" at the bottom is a visual label of that same link, never a second control. Hover lifts the card and
 * darkens its border; focus draws the same 3 px ring the rest of the app uses; a node that is not teaching sets
 * `aria-disabled` and the card goes flat.
 */
const Door = styled(Link)<{ $primary?: boolean }>`
  display: flex; flex-direction: column; gap: 10px; border-radius: 10px; text-decoration: none; color: inherit; cursor: pointer;
  padding: ${(p) => (p.$primary ? '28px 28px 24px' : '20px')};
  background: ${(p) => (p.$primary ? p.theme.color.PALE_GREY : '#fff')};
  border: ${(p) => (p.$primary ? `2px solid ${p.theme.color.PRIMARY}` : `1px solid ${p.theme.color.LIGHT_GREY}`)};
  transition: box-shadow 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
  h2 { margin: 0; font-size: ${(p) => (p.$primary ? '22px' : '16px')}; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; }
  p { margin: 0; font-size: ${(p) => (p.$primary ? '15px' : '14px')}; line-height: 1.6; color: ${(p) => p.theme.color.DARK_GREY}; flex: 1; }
  &:hover { border-color: ${(p) => p.theme.color.HOVER}; box-shadow: 0 6px 18px rgba(48, 49, 51, 0.12); transform: translateY(-1px); }
  &:hover .cta { background: ${(p) => (p.$primary ? p.theme.color.HOVER : `${p.theme.color.PRIMARY}0f`)}; border-color: ${(p) => p.theme.color.HOVER}; }
  &:focus-visible { outline: 3px solid ${(p) => p.theme.color.PRIMARY}; outline-offset: 3px; }
  &[aria-disabled='true'] { cursor: not-allowed; opacity: 0.55; box-shadow: none; transform: none; border-color: ${(p) => (p.$primary ? p.theme.color.PRIMARY : p.theme.color.LIGHT_GREY)}; }
  &[aria-disabled='true'] .cta { background: ${(p) => (p.$primary ? p.theme.color.PRIMARY : 'transparent')}; border-color: ${(p) => (p.$primary ? p.theme.color.PRIMARY : `${p.theme.color.PRIMARY}80`)}; }
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { padding: ${(p) => (p.$primary ? '22px 20px 20px' : '18px 16px')}; }
`;
/** The visual label at the foot of a door — the same shape as the app's buttons, but it is the card that is the control. */
const Cta = styled.span<{ $primary?: boolean }>`
  display: inline-flex; align-items: center; justify-content: center; width: 100%; box-sizing: border-box; border-radius: 4px;
  padding: ${(p) => (p.$primary ? '10px 22px' : '6px 16px')}; font-size: ${(p) => (p.$primary ? '15px' : '14px')}; font-weight: 500; line-height: 1.75; letter-spacing: 0.02em;
  color: ${(p) => (p.$primary ? '#fff' : p.theme.color.PRIMARY)};
  background: ${(p) => (p.$primary ? p.theme.color.PRIMARY : 'transparent')};
  border: 1px solid ${(p) => (p.$primary ? p.theme.color.PRIMARY : `${p.theme.color.PRIMARY}80`)};
  transition: background-color 0.2s ease, border-color 0.2s ease;
`;
/**
 * The file door's hard limits (ux-critique-owner O-4), as two chips beside the picker label instead of small print
 * under it: the formats this node reads and the question cap — both from GET /api/teach/policy, never a constant
 * in the bundle. The upload page then refuses a wrong type or an oversized file at selection, before any upload.
 */
const Limits = styled.ul`
  display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none;
  li { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 12px; font-size: 12px; font-weight: 600; letter-spacing: 0.01em;
    color: ${(p) => p.theme.color.HOVER}; background: ${(p) => p.theme.color.PALE_GREY}; white-space: nowrap; }
`;
/** The secondary door's eyebrow: says who it is for before the visitor reads the card. */
const Eyebrow = styled.span`
  font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: ${(p) => p.theme.color.GREY};
`;
/**
 * The readiness line (O-5): the Alert palette, one plain sentence, and the node's own sentence behind a native
 * <details>. A node that is off or paused renders the sentence alone — it is already plain language.
 */
const Ready = styled(Alert)`
  margin-top: 16px; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 14px;
  p { margin: 0; }
  details { flex: 1 0 100%; font-size: 13px; }
  details[open] { margin-top: 2px; }
  summary { cursor: pointer; width: fit-content; font-weight: 600; border-radius: 4px; padding: 1px 4px; margin-left: -4px; }
  summary:focus-visible { outline: 3px solid ${(p) => p.theme.color.PRIMARY}; outline-offset: 1px; }
  details p { margin: 6px 0 0; opacity: 0.9; }
`;
/**
 * The trust strip (ux-critique-owner O-10): four facts, each true in the code — drafts are private until published
 * (teach.ts: only an owner-published lesson can be announced), publishing is a separate signed and consented step,
 * the teaching key lives in localStorage and the node sees only its address, and the operator CAN read private
 * drafts (the same "Not private from the operator" the keep-private sheet says). The meaning of each sits behind a
 * native <details>, and the full terms are one link away.
 */
const Trust = styled.section`
  margin-top: 16px; padding: 12px 16px; border-radius: 8px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; background: #fff;
  font-size: 13px; color: ${(p) => p.theme.color.DARK_GREY};
  ul { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 0; padding: 0; list-style: none; }
  li { display: inline-flex; align-items: center; gap: 6px; }
  li svg { flex: none; }
  details { margin-top: 8px; }
  summary { cursor: pointer; width: fit-content; font-weight: 600; color: ${(p) => p.theme.color.PRIMARY}; border-radius: 4px; padding: 1px 4px; margin-left: -4px; }
  summary:hover { color: ${(p) => p.theme.color.HOVER}; }
  summary:focus-visible { outline: 3px solid ${(p) => p.theme.color.PRIMARY}; outline-offset: 1px; }
  dl { margin: 8px 0 0; display: grid; grid-template-columns: max-content 1fr; gap: 8px 14px; }
  dt { font-weight: 600; color: ${(p) => p.theme.color.BLACK}; }
  dd { margin: 0; line-height: 1.6; max-width: 72ch; }
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { dl { grid-template-columns: 1fr; gap: 2px 0; } dd { margin-bottom: 8px; } }
  .row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 16px; }
  a { color: ${(p) => p.theme.color.PRIMARY}; font-weight: 600; white-space: nowrap; }
  a:focus-visible { outline: 3px solid ${(p) => p.theme.color.PRIMARY}; outline-offset: 2px; border-radius: 2px; }
`;
const TRUST = [
  ['private', 'teach.trust.private', 'teach.trust.private_body'],
  ['publish', 'teach.trust.publish', 'teach.trust.publish_body'],
  ['key', 'teach.trust.key', 'teach.trust.key_body'],
  ['operator', 'teach.trust.operator', 'teach.trust.operator_body'],
] as const;
/** A small lock, the same purple as the rest of the page; decorative, the words carry the meaning. */
const Lock = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden fill="#8b3eeb">
    <path d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-7-2a2 2 0 1 1 4 0v2h-4V7Z" />
  </svg>
);
/** One line under the title (O-7): wider than `Description`'s 72ch so the English sentence stays on one line at 944 px. */
const Intro = styled(Description)`max-width: none; font-size: 15px;`;
/** The longer story, behind a disclosure (O-7): a native <details> — keyboard-operable, announced as expandable, no script. */
const How = styled.details`
  margin-top: 20px; font-size: 14px; color: ${(p) => p.theme.color.DARK_GREY};
  summary { cursor: pointer; font-weight: 600; color: ${(p) => p.theme.color.PRIMARY}; width: fit-content; border-radius: 4px; padding: 2px 4px; margin-left: -4px; }
  summary:hover { color: ${(p) => p.theme.color.HOVER}; }
  summary:focus-visible { outline: 3px solid ${(p) => p.theme.color.PRIMARY}; outline-offset: 1px; }
  p { margin: 8px 0 0; line-height: 1.65; max-width: 78ch; }
`;
/**
 * "What happens next" (ux-critique-owner O-2): a plain sentence, not a stepper. The entry page has no current step,
 * so nothing here may look like progress or like buttons — no numbered discs, no boxes, no colour states. The real
 * Stepper, with the current step highlighted, starts on the first page of the flow.
 */
const Next = styled.p`
  margin: 20px 0 0; font-size: 14px; line-height: 1.6; color: ${(p) => p.theme.color.DARK_GREY};
  b { font-weight: 600; color: ${(p) => p.theme.color.BLACK}; }
  span { white-space: nowrap; }
`;

export default function TeachPage() {
  const { t } = useT();
  useTitle(t('teach.entry.title'));
  const { data: policy, isLoading } = useTeachPolicyQuery(undefined, { pollingInterval: 60_000 });
  const ready = readiness(policy, t, policyLine(policy, t).text);
  const open = !!policy?.enabled && policy.trainer !== 'paused';
  const formats = policy?.limits?.formats?.length ? policy.limits.formats : ['jsonl', 'csv', 'tsv', 'txt'];
  /** finding 50 — two different caps: what one lesson teaches, and what one dataset may hold. */
  const lessonCap = rowsPerJob(policy);
  const storeCap = policy?.limits?.dataset_max_rows ?? lessonCap;

  return (
    <PageWrapper data-testid="teach-entry">
      <TitleRow><Title>{t('teach.entry.title')}</Title></TitleRow>
      <Intro>{t('teach.entry.sub')}</Intro>

      {!isLoading && ready.text && (
        <Ready $tone={ready.ok ? 'info' : 'warning'} role="status" data-testid="teach-policy">
          <p data-testid="teach-ready">{ready.text}</p>
          {ready.detail.length > 0 && (
            <details data-testid="teach-ready-detail">
              <summary>{t('teach.ready.details')}</summary>
              {ready.detail.map((line) => <p key={line}>{line}</p>)}
            </details>
          )}
        </Ready>
      )}

      <Doors>
        <Door
          $primary to="/chat?teach=1" data-testid="door-chat" aria-labelledby="door-chat-title door-chat-cta" aria-describedby="door-chat-body"
          aria-disabled={open ? undefined : true} tabIndex={open ? undefined : -1} onClick={(e) => { if (!open) e.preventDefault(); }}
        >
          <h2 id="door-chat-title">{t('teach.entry.chat.title')}</h2>
          <p id="door-chat-body">{t('teach.entry.chat.body')}</p>
          <Cta $primary className="cta" id="door-chat-cta" data-testid="door-chat-cta">{t('teach.entry.chat.cta')}</Cta>
        </Door>
        <Door
          to="/teach/upload" data-testid="door-file" aria-labelledby="door-file-title door-file-cta" aria-describedby="door-file-body"
          aria-disabled={open ? undefined : true} tabIndex={open ? undefined : -1} onClick={(e) => { if (!open) e.preventDefault(); }}
        >
          <Eyebrow>{t('teach.entry.file.eyebrow')}</Eyebrow>
          <h2 id="door-file-title">{t('teach.entry.file.title')}</h2>
          <p id="door-file-body">{t('teach.entry.file.body')}</p>
          <Limits aria-label={t('teach.entry.file.limits_aria')} data-testid="door-file-limits">
            <li>{formats.join(' · ')}</li>
            {/*
              Finding 50 — this chip showed the STORAGE cap (2,000) and nothing else, so 2,000 was the first and
              only number a prospective teacher saw, and the one they sized their file to. The number that governs
              what actually gets taught is rows_per_job; it leads, with the storage cap in brackets behind it.
            */}
            <li data-testid="door-file-cap">{lessonCap < storeCap
              ? t('teach.entry.file.cap_both', { lesson: lessonCap, stored: storeCap })
              : t('teach.entry.file.cap', { max: lessonCap })}</li>
          </Limits>
          <Cta className="cta" id="door-file-cta" data-testid="door-file-cta">{t('teach.entry.file.cta')}</Cta>
        </Door>
      </Doors>

      <Trust aria-label={t('teach.trust.aria')} data-testid="trust-strip">
        <div className="row">
          <ul>
            {TRUST.map(([id, title]) => <li key={id} data-testid={`trust-${id}`}><Lock />{t(title)}</li>)}
          </ul>
          <Link to="/terms#teaching" data-testid="trust-terms">{t('teach.trust.terms')} →</Link>
        </div>
        <details data-testid="trust-detail">
          <summary>{t('teach.trust.more')}</summary>
          <dl>
            {TRUST.map(([id, title, body]) => [<dt key={`${id}-t`}>{t(title)}</dt>, <dd key={`${id}-d`}>{t(body)}</dd>])}
          </dl>
        </details>
      </Trust>

      <Next data-testid="teach-next">
        <b>{t('teach.entry.next_label')}:</b>{' '}
        {STEP_KEYS.map((key, i) => <span key={key}>{i > 0 && ' → '}{t(key)}</span>)}
        {' — '}{t('teach.entry.next_same')}
      </Next>

      <How data-testid="how-it-works">
        <summary>{t('teach.entry.how.title')}</summary>
        <p>{t('teach.entry.how.body')}</p>
      </How>
    </PageWrapper>
  );
}
