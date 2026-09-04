import styled from 'styled-components';
import type { TeachJob } from '@/api/types';
import { useT } from '@/i18n';
import { num } from '@/utils/format';

/**
 * SC-7 — what a lesson taught ON TOP of someone else's knowledge did to it, on the result screen of both doors.
 *
 * Everything here is read from what the node measured in CHECKING (§7.6): `parent_check` is the base's OWN questions
 * re-asked with the lesson loaded on top, and `reversibility_ok` is the base read back after the lesson came off
 * again (§7.6 step 6). Nothing is computed in the browser, so a stub node's simulated run says so through the same
 * banner as every other number on the screen and never gets a sentence of its own here.
 *
 * A lesson with no base renders nothing at all — the whole block is about a relationship that does not exist.
 */
const Panel = styled.section`
  margin-top: 16px; padding: 14px 16px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 8px; background: #fff;
  h2 { margin: 0 0 8px; font-size: 15px; }
  p { margin: 0 0 6px; font-size: 13.5px; line-height: 1.6; color: ${(p) => p.theme.color.DARK_GREY}; }
  p:last-child { margin-bottom: 0; }
  p.bad { color: ${(p) => p.theme.color.WARNING}; }
`;
const Lines = styled.div`
  display: flex; flex-direction: column; gap: 6px; font-size: 13px; line-height: 1.6; color: ${(p) => p.theme.color.DARK_GREY};
  span.bad { color: ${(p) => p.theme.color.WARNING}; }
`;

/** The lines themselves, so the chat card can drop them into its own body without a second panel around them. */
export function BuiltOnLines({ j }: { j: TeachJob }) {
  const { t } = useT();
  const bases = j.bases ?? [];
  if (!bases.length) return null;
  const direct = bases[bases.length - 1];
  const name = direct.name ?? direct.patch_id;
  const changed = j.changed_rows ?? 0;
  const added = Math.max(0, (j.facts?.length ?? 0) - changed);
  const pc = j.checks?.parent_check?.find((x) => x.patch_id === direct.patch_id);
  const broken = pc && pc.total ? pc.failed.length : 0;
  return (
    <Lines data-testid="built-on">
      <span>{t('teach.res.built_on', { name, m: num(added), k: num(changed), rows: num(j.result?.rows ?? 0) })}</span>
      {!!pc?.total && (broken
        ? <span className="bad" data-testid="parent-broken">{t('teach.res.parent_broken', { name, k: num(broken), list: pc.failed.slice(0, 6).map((i) => i + 1).join(', ') })}</span>
        : <span data-testid="parent-ok">{t('teach.res.parent_ok', { name, hit: num(pc.hit), total: num(pc.total) })}</span>)}
      {j.checks?.reversibility_ok === true && <span data-testid="reversible">{t('teach.res.reversible', { name })}</span>}
    </Lines>
  );
}

export function BuiltOn({ j }: { j: TeachJob }) {
  const { t } = useT();
  if (!j.bases?.length) return null;
  return (
    <Panel data-testid="built-on-block">
      <h2>{t('teach.res.built_on_title')}</h2>
      <BuiltOnLines j={j} />
    </Panel>
  );
}
