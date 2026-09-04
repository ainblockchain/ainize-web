import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import styled from 'styled-components';
import { errorMessage, useCatalogQuery, useCreateTeachJobMutation, useMergePreviewMutation, useTeachPolicyQuery } from '@/api/api';
import type { MergeConflict, MergePreview } from '@/api/types';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { Button } from '@/components/ui/Button';
import { Alert, Input, SelectField } from '@/components/ui/Form';
import { CenterProgress, Description, PageWrapper, Title, TitleRow } from '@/components/ui/Misc';
import { rememberJob } from '@/lib/teachStore';

/**
 * `/teach/merge?a=&b=` — combining two knowledges (design §4 SC-14, §9).
 *
 * The screen is the design's four steps in one scroll: what OVERLAPS (questions and rows, both measured by the node),
 * which questions the two answer DIFFERENTLY (one card each, resolved by a person — nothing is built until every one
 * has an answer), HOW to build it, and what will be CHECKED afterwards.
 *
 * The one thing the screen must never offer is a fourth option that blends the two rows: where the two knowledges
 * wrote different values into the same row, an average is a value neither of them measured (§9 Forbidden, F8). The
 * absence is stated in words (`merge.no_average`) so it reads as a rule and not as a missing button.
 */
const Section = styled.section`
  display: flex; flex-direction: column; gap: 10px; padding: 16px 0; border-bottom: 1px solid #f0f0f0;
  h2 { margin: 0; font-size: 15px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; }
  p.line { margin: 0; font-size: 13.5px; line-height: 1.6; color: ${(p) => p.theme.color.DARK_GREY}; }
  p.hint { margin: 0; font-size: 12.5px; line-height: 1.55; color: ${(p) => p.theme.color.GREY}; }
`;
const Steps = styled.ol`
  display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 4px; padding: 0; list-style: none;
  li { font-size: 12.5px; color: ${(p) => p.theme.color.GREY}; }
  li[data-on='1'] { color: ${(p) => p.theme.color.PRIMARY}; font-weight: 700; }
  li::after { content: '·'; margin-left: 8px; color: ${(p) => p.theme.color.LIGHT_GREY}; }
  li:last-child::after { content: ''; }
`;
const Card = styled.div`
  display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 8px;
  p.q { margin: 0; font-size: 14px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; }
  p.a { margin: 0; font-size: 13px; color: ${(p) => p.theme.color.DARK_GREY}; }
  div.row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
`;
const Tier = styled.label<{ $off?: boolean; $req?: boolean }>`
  display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border-radius: 8px; cursor: ${(p) => (p.$off ? 'not-allowed' : 'pointer')};
  border: 1px solid ${(p) => (p.$req ? p.theme.color.PRIMARY : p.theme.color.LIGHT_GREY)};
  opacity: ${(p) => (p.$off ? 0.55 : 1)};
  span.t { font-size: 13.5px; font-weight: 600; color: ${(p) => p.theme.color.BLACK}; }
  span.w { display: block; font-size: 12.5px; font-weight: 400; color: ${(p) => p.theme.color.GREY}; }
`;
const Bulk = styled.div`display: flex; flex-wrap: wrap; gap: 8px;`;

type Choice = 'a' | 'b' | 'drop' | { answer: string };
const TIERS = ['union', 'retrain', 'rebuild'] as const;

export default function MergePage() {
  const { t } = useT();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const a = params.get('a') ?? '';
  const b = params.get('b') ?? '';
  useTitle(a && b ? t('merge.title', { A: a, B: b }) : t('merge.pick_two'));
  const { data: policy } = useTeachPolicyQuery();
  const { data: catalog } = useCatalogQuery({ limit: 100 });
  const [preview, { data: p, isLoading, error: previewError }] = useMergePreviewMutation();
  const [createJob, { isLoading: building, error: buildError }] = useCreateTeachJobMutation();
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [tier, setTier] = useState<typeof TIERS[number] | ''>('');

  useEffect(() => { if (a && b) { setChoices({}); setTier(''); void preview({ a, b }); } }, [a, b, preview]);

  const nameOf = (id: string) => (p && p.a.id === id ? p.a.name : p && p.b.id === id ? p.b.name : catalog?.items.find((x) => x.anchor.id === id)?.anchor.name) ?? id;
  const conflicts = p?.questions?.conflicts ?? [];
  const open = conflicts.filter((c) => choices[c.key] === undefined);
  const chosenTier = tier || p?.tiers.required || (p?.tiers.union.allowed ? 'union' : p?.tiers.retrain.allowed ? 'retrain' : 'rebuild');
  const canBuild = !!p && !open.length && !!p.tiers[chosenTier as typeof TIERS[number]]?.allowed && !building;
  // a combine writes a stand-alone file unless both parents were built on the same thing; a rebuild always does
  const standAlone = chosenTier === 'rebuild' || (chosenTier === 'union' && p?.tiers.union.export === 'squash');

  const build = async () => {
    if (!p) return;
    const res = await createJob({
      patch_ids: [], builds_on_context: false, base_ids: [p.a.id, p.b.id], mode: 'merge',
      tier: chosenTier as typeof TIERS[number], resolutions: choices,
      name: `${p.a.name} + ${p.b.name}`.slice(0, 80),
    });
    const job = (res as { data?: { job?: { id: string; name?: string } } }).data?.job;
    if (!job) return;
    rememberJob({ id: job.id, name: job.name, created_at: Date.now() });
    navigate(`/teach/lesson/${job.id}`);
  };

  if (policy && !policy.lineage) return <PageWrapper><Alert $tone="warning">{t('merge.disabled')}</Alert></PageWrapper>;
  // arriving from a knowledge page there is one id in the URL: it is kept, and only the other one is asked for
  if (!a || !b) return <PageWrapper><Picker first={a || b} onPick={(x, y) => setParams({ a: x, b: y })} /></PageWrapper>;
  if (isLoading || (!p && !previewError)) return <CenterProgress />;
  if (previewError || !p) return <PageWrapper><Alert $tone="error">{t('merge.failed', { message: errorMessage(previewError) })}</Alert></PageWrapper>;

  const A = p.a.name; const B = p.b.name;
  const pct = Math.round(p.tiers.disagree_ratio * 100);
  const reason = (r?: string) => t(`merge.reason.${r ?? 'rows_disagree'}`);

  return (
    <PageWrapper>
      <TitleRow><Title>{t('merge.title', { A, B })}</Title></TitleRow>
      <Steps>
        <li data-on="1">{t('merge.step.overlap')}</li>
        <li data-on={conflicts.length ? '1' : '0'}>{t('merge.step.conflicts')}</li>
        <li data-on={open.length ? '0' : '1'}>{t('merge.step.build')}</li>
        <li>{t('merge.step.check')}</li>
      </Steps>

      {/* 1 — overlap, measured */}
      <Section>
        <h2>{t('merge.step.overlap')}</h2>
        {p.questions
          ? <p className="line">{t('merge.questions', { A, B, a: p.questions.a_only, b: p.questions.b_only, same: p.questions.same, conf: p.questions.conflicts.length })}</p>
          : <p className="line">{t('merge.private_parent', { name: nameOf(p.private_parent ?? '') })}</p>}
        <p className="line">{t('merge.rows', { A, B, ra: p.rows.a_only, rb: p.rows.b_only, shared: p.rows.shared, dis: p.rows.disagree })}</p>
        {p.merged && <p className="hint">{t('merge.combined_set', { A, B, n: p.merged.rows, ra: p.merged.from_a, rb: p.merged.from_b })}</p>}
        <p className="hint">{t('merge.license', { a: p.licenses.a ?? '—', b: p.licenses.b ?? '—', child: p.licenses.child_min ?? '—' })}</p>
      </Section>

      {/* 2 — the questions they answer differently */}
      {!!conflicts.length && (
        <Section>
          <h2>{t('merge.step.conflicts')}</h2>
          <Bulk>
            <Button variant="outlined" onClick={() => setChoices(Object.fromEntries(conflicts.map((c) => [c.key, 'a' as Choice])))}>{t('merge.bulk_a', { A })}</Button>
            <Button variant="outlined" onClick={() => setChoices(Object.fromEntries(conflicts.map((c) => [c.key, 'b' as Choice])))}>{t('merge.bulk_b', { B })}</Button>
          </Bulk>
          {conflicts.map((c) => (
            <ConflictCard key={c.key} c={c} A={A} B={B} value={choices[c.key]} onChange={(v) => setChoices((prev) => ({ ...prev, [c.key]: v }))} />
          ))}
          {!!open.length && <p className="hint">{t('merge.unresolved', { n: open.length })}</p>}
        </Section>
      )}

      {/* 3 — how it is built */}
      <Section>
        <h2>{t('merge.tier_title')}</h2>
        {p.tiers.required === 'rebuild' && <Alert $tone="warning">{t('merge.tier_required', { pct })}</Alert>}
        <Tier $off={!p.tiers.union.allowed} $req={p.tiers.required === 'union'}>
          <input type="radio" name="tier" disabled={!p.tiers.union.allowed} checked={chosenTier === 'union'} onChange={() => setTier('union')} />
          <span className="t">{t('merge.tier_union')}
            {!p.tiers.union.allowed && <span className="w">{p.tiers.union.reason === 'rows_disagree' ? t('merge.tier_union_off', { dis: p.rows.disagree }) : t('merge.tier_off', { reason: reason(p.tiers.union.reason) })}</span>}
          </span>
        </Tier>
        <Tier $off={!p.tiers.retrain.allowed} $req={p.tiers.required === 'retrain'}>
          <input type="radio" name="tier" disabled={!p.tiers.retrain.allowed} checked={chosenTier === 'retrain'} onChange={() => setTier('retrain')} />
          <span className="t">{p.tiers.retrain.est_min == null ? t('merge.tier_retrain_untimed', { d: conflicts.length }) : t('merge.tier_retrain', { d: conflicts.length, min: p.tiers.retrain.est_min })}
            {p.tiers.retrain.allowed && p.tiers.retrain.est_min == null && <span className="w">{t('merge.tier_untimed')}</span>}
            {!p.tiers.retrain.allowed && <span className="w">{t('merge.tier_off', { reason: reason(p.tiers.retrain.reason) })}</span>}
          </span>
        </Tier>
        <Tier $off={!p.tiers.rebuild.allowed} $req={p.tiers.required === 'rebuild'}>
          <input type="radio" name="tier" disabled={!p.tiers.rebuild.allowed} checked={chosenTier === 'rebuild'} onChange={() => setTier('rebuild')} />
          <span className="t">{p.tiers.rebuild.est_min == null ? t('merge.tier_rebuild_untimed') : t('merge.tier_rebuild', { h: Math.max(1, Math.round(p.tiers.rebuild.est_min / 60)) })}
            {p.tiers.rebuild.allowed && p.tiers.rebuild.est_min == null && <span className="w">{t('merge.tier_untimed')}</span>}
            {!p.tiers.rebuild.allowed && <span className="w">{t('merge.tier_off', { reason: reason(p.tiers.rebuild.reason) })}</span>}
          </span>
        </Tier>
        <p className="hint">{t('merge.no_average')}</p>
      </Section>

      {/* 4 — what will be checked, and who is paid */}
      <Section>
        <h2>{t('merge.step.check')}</h2>
        <p className="hint">{t('merge.will_check', { A, B })}</p>
        {/* what a buyer needs depends on what this build writes: a combined stand-alone file carries both parents'
            rows, a delta over them does not (§9 T0 vs T1/T2) */}
        <p className="line">{t(standAlone ? 'merge.footer_squash' : 'merge.footer', { A, B, lineage: Math.round((policy?.shares.lineage ?? 0.3) * 100) })}</p>
      </Section>

      {!!buildError && <Alert $tone="error">{t('merge.failed', { message: errorMessage(buildError) })}</Alert>}
      <TitleRow>
        <Button variant="contained" onClick={build} disabled={!canBuild}>{building ? t('merge.building') : t('merge.build')}</Button>
      </TitleRow>
    </PageWrapper>
  );
}

function ConflictCard({ c, A, B, value, onChange }: { c: MergeConflict; A: string; B: string; value?: Choice; onChange: (v: Choice) => void }) {
  const { t } = useT();
  const [own, setOwn] = useState(typeof value === 'object' ? value.answer : '');
  const mine = typeof value === 'object';
  return (
    <Card>
      <p className="q">{c.prompt}</p>
      <p className="a">{t('merge.conflict_card', { A, B, a_answer: c.a_answer, b_answer: c.b_answer })}</p>
      <div className="row">
        <Button variant={value === 'a' ? 'contained' : 'outlined'} onClick={() => onChange('a')}>{t('merge.keep_a', { A })}</Button>
        <Button variant={value === 'b' ? 'contained' : 'outlined'} onClick={() => onChange('b')}>{t('merge.keep_b', { B })}</Button>
        <Input placeholder={t('merge.own_ph')} value={own} onChange={(e) => setOwn(e.target.value)} onBlur={() => own.trim() && onChange({ answer: own.trim() })} aria-label={t('merge.own')} />
        <Button variant={mine ? 'contained' : 'outlined'} onClick={() => own.trim() && onChange({ answer: own.trim() })} disabled={!own.trim()}>{t('merge.own')}</Button>
        <Button variant={value === 'drop' ? 'contained' : 'outlined'} onClick={() => onChange('drop')}>{t('merge.drop')}</Button>
      </div>
    </Card>
  );
}

/** No pair in the URL: two lists of what this node holds, so the screen is reachable without knowing an id. */
function Picker({ onPick, first = '' }: { onPick: (a: string, b: string) => void; first?: string }) {
  const { t } = useT();
  const { data } = useCatalogQuery({ limit: 100 });
  const items = useMemo(() => (data?.items ?? []).filter((e) => e.status === 'LISTED' || e.status === 'ANNOUNCED'), [data]);
  const [a, setA] = useState(first); const [b, setB] = useState('');
  return (
    <>
      <TitleRow><Title>{t('merge.pick_two')}</Title></TitleRow>
      <Description>{t('merge.no_average')}</Description>
      <SelectField label={t('merge.pick_a')} value={a} onChange={(e) => setA(e.target.value)}>
        <option value="">—</option>
        {items.map((e) => <option key={e.anchor.id} value={e.anchor.id}>{e.anchor.name}</option>)}
      </SelectField>
      <SelectField label={t('merge.pick_b')} value={b} onChange={(e) => setB(e.target.value)}>
        <option value="">—</option>
        {items.filter((e) => e.anchor.id !== a).map((e) => <option key={e.anchor.id} value={e.anchor.id}>{e.anchor.name}</option>)}
      </SelectField>
      <TitleRow><Button variant="contained" disabled={!a || !b} onClick={() => onPick(a, b)}>{t('merge.build')}</Button></TitleRow>
    </>
  );
}
