import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import styled from 'styled-components';
import {
  errorMessage, useAddTeachBanMutation, useApproveTeachJobMutation, useCancelTeachJobAdminMutation, useDeleteTeachBanMutation, useInfoQuery, usePayoutsQuery,
  useRejectTeachJobMutation, useRetryPayoutMutation, useSetContributorHiddenMutation, useTeachAdminJobsQuery, useTeachAdminPolicyQuery, useTeachBansQuery,
  useTeachContributorsQuery, useUpdateTeachAdminPolicyMutation,
} from '@/api/api';
import type { PayoutRow, TeachJobAdmin, TeachPolicyPatch } from '@/api/types';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Alert, Checkbox, TextField } from '@/components/ui/Form';
import { CenterProgress, Description, Mono, StyledLink, SubTitle } from '@/components/ui/Misc';
import { SubText, Table, TableBody, TableData, TableHead, TableHeader, TableRow, TableRowEmpty, TableWrapper } from '@/components/ui/Table';
import { Muted, RadioGroup, Row, SmallSpinner, Stack, useElapsed, useMoney } from '@/components/operator/common';
import { dateTime, shortAddr, shortHash } from '@/utils/format';

/**
 * Operator Teaching tab on My knowledge (spec §5.13): settings (PATCH /api/me/teach/policy), the lesson queue with
 * Approve / Decline / Cancel, contributors (hide name, block key / IP) and the data-provider payouts with Retry.
 * Plain language for the operator too — no "patch / anchor / npz" here.
 */
const Note = styled.p`margin: 12px 0 0; padding: 12px 16px; border-left: 3px solid #8b3eeb; background: #faf7ff; font-size: 14px; line-height: 1.6; color: #333; word-break: keep-all; max-width: 760px;`;
const SettingsForm = styled.form`margin-top: 16px; display: flex; flex-direction: column; gap: 18px; max-width: 720px; padding: 20px 24px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; background: #fff;`;
const Grid = styled.div`display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;`;
const FieldLabel = styled.span`font-size: 12px; color: #8d8d8f; font-weight: 500;`;
const Slider = styled.input`width: 100%; max-width: 360px; accent-color: #8b3eeb;`;
const Chip = styled.span<{ $tone: 'ok' | 'warn' | 'bad' | 'muted' | 'busy' }>`
  display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; white-space: nowrap;
  ${(p) => p.$tone === 'ok' ? 'background:#e6f4ea;color:#1e6b36;' : p.$tone === 'warn' ? 'background:#fff3e0;color:#8a4b00;' : p.$tone === 'bad' ? 'background:#fde8ec;color:#a0102c;' : p.$tone === 'busy' ? 'background:#f5eefc;color:#5b1ca8;' : 'background:#f0f0f0;color:#6b6b6b;'}
`;
const Tiles = styled.div`display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 200px)); gap: 12px; margin-top: 12px;`;
const Tile = styled.div<{ $tone?: 'bad' | 'ok' | 'warn' }>`
  padding: 12px 16px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; background: #fff;
  .k { font-size: 12px; color: #8d8d8f; } .v { font-size: 22px; font-weight: 700; color: ${(p) => (p.$tone === 'bad' ? '#a0102c' : p.$tone === 'ok' ? '#1e6b36' : p.$tone === 'warn' ? '#8a4b00' : '#333')}; }
`;
const ReasonRow = styled.div`display: flex; gap: 8px; align-items: flex-end; margin-top: 8px; flex-wrap: wrap;`;

const ACTIVE = new Set(['QUEUED', 'PREFLIGHT', 'LOADING', 'TRAINING', 'EXPORTED', 'CHECKING']);
const statusTone = (s: string): 'ok' | 'warn' | 'bad' | 'muted' | 'busy' =>
  s === 'ANNOUNCED' || s === 'READY' ? 'ok' : s === 'PENDING_REVIEW' || s === 'NEEDS_MORE' ? 'warn' : s === 'FAILED' || s === 'REJECTED' ? 'bad' : ACTIVE.has(s) ? 'busy' : 'muted';

interface Form { enabled: boolean; publish: 'review' | 'auto' | 'never'; facts: number; perKey: number; perIp: number; queue: number; ttl: number; share: number; paused: string; blocked: string }

export default function TeachingTab() {
  const { t } = useT();
  const money = useMoney();
  const elapsed = useElapsed();
  const { data: info } = useInfoQuery();
  const policy = useTeachAdminPolicyQuery();
  const [anyActive, setAnyActive] = useState(false);
  const jobs = useTeachAdminJobsQuery(undefined, { pollingInterval: anyActive ? 5000 : 30_000 });
  const contributors = useTeachContributorsQuery();
  const bans = useTeachBansQuery();
  const payouts = usePayoutsQuery({ limit: 100 });
  const [updatePolicy, updateState] = useUpdateTeachAdminPolicyMutation();
  const [approve, approveState] = useApproveTeachJobMutation();
  const [reject, rejectState] = useRejectTeachJobMutation();
  const [cancel, cancelState] = useCancelTeachJobAdminMutation();
  const [setHidden, hiddenState] = useSetContributorHiddenMutation();
  const [addBan, addBanState] = useAddTeachBanMutation();
  const [deleteBan, deleteBanState] = useDeleteTeachBanMutation();
  const [retryPayout, retryState] = useRetryPayoutMutation();

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [banReason, setBanReason] = useState('');

  const items = useMemo(() => jobs.data?.items ?? [], [jobs.data]);
  const active = items.some((j) => ACTIVE.has(j.status));
  useEffect(() => { setAnyActive(active); }, [active]);
  const pendingReview = items.filter((j) => j.status === 'PENDING_REVIEW').length;
  /** last IP seen per contributor address (jobs carry the request IP for the operator) */
  const ipOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const j of items) { const a = j.contributor.address.toLowerCase(); if (j.ip && !m.has(a)) m.set(a, j.ip); }
    return m;
  }, [items]);
  const banOf = (kind: 'address' | 'ip', value: string) => (bans.data?.items ?? []).find((b) => b.kind === kind && b.value.toLowerCase() === value.toLowerCase());

  // ---------------------------------------------------------------- settings form (seeded from the effective config)
  const eff = policy.data?.effective;
  const [form, setForm] = useState<Form | null>(null);
  useEffect(() => {
    if (!eff) return;
    setForm({
      enabled: eff.enabled, publish: eff.publish, facts: eff.factsPerJob, perKey: eff.jobsPerKeyPerDay, perIp: eff.jobsPerIpPerDay, queue: eff.queueMax, ttl: eff.draftTtlDays,
      share: Math.round(eff.contributorShare * 100), paused: eff.pausedReason ?? '', blocked: eff.blockedTopics ?? '',
    });
  }, [eff]);
  const patchOf = (f: Form): TeachPolicyPatch => {
    if (!eff) return {};
    const p: TeachPolicyPatch = {};
    if (f.enabled !== eff.enabled) p.enabled = f.enabled;
    if (f.publish !== eff.publish) p.publish = f.publish;
    if (f.facts !== eff.factsPerJob) p.facts_per_job = f.facts;
    if (f.perKey !== eff.jobsPerKeyPerDay) p.jobs_per_key_per_day = f.perKey;
    if (f.perIp !== eff.jobsPerIpPerDay) p.jobs_per_ip_per_day = f.perIp;
    if (f.queue !== eff.queueMax) p.queue_max = f.queue;
    if (f.ttl !== eff.draftTtlDays) p.draft_ttl_days = f.ttl;
    if (f.share !== Math.round(eff.contributorShare * 100)) p.contributor_share = f.share / 100;
    if (f.paused.trim() !== (eff.pausedReason ?? '')) p.paused_reason = f.paused.trim() || null;
    if (f.blocked.trim() !== (eff.blockedTopics ?? '')) p.blocked_topics = f.blocked.trim() || null;
    return p;
  };
  const dirty = !!form && Object.keys(patchOf(form)).length > 0;
  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setError(null); setNotice(null);
    try { await updatePolicy(patchOf(form)).unwrap(); setNotice(t('op.teach.settings.saved')); } catch (err) { setError(errorMessage(err)); }
  };
  const run = async (fn: () => Promise<unknown>, ok?: string) => { setError(null); setNotice(null); try { await fn(); if (ok) setNotice(ok); } catch (err) { setError(errorMessage(err)); } };

  if (policy.isLoading) return <CenterProgress />;
  if (policy.isError) {
    const status = (policy.error as { status?: number }).status;
    return <Alert $tone="warning" style={{ marginTop: 24 }} data-testid="teach-unavailable">{status === 404 ? t('op.teach.unavailable') : t('common.error', { message: errorMessage(policy.error) })}</Alert>;
  }
  const trainer = policy.data?.trainer;
  const currency = info?.currency ?? '';
  const nodeAddress = info?.node.address ?? '';
  const num = (v: string, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number(v) || lo)));
  const statusLabel = (j: TeachJobAdmin) => { const k = `op.teach.status.${j.status}`; const v = t(k); return v === k ? j.status : v; };
  const lessonName = (j: TeachJobAdmin) => j.name || j.facts?.[0]?.prompt || t('op.teach.queue.untitled');
  const payoutTone = (s: PayoutRow['status']) => (s === 'paid' ? 'ok' : s === 'failed' ? 'bad' : 'warn');

  return (
    <div data-testid="teaching-tab">
      <Description style={{ marginTop: 16 }}>{t('op.teach.desc')}</Description>
      <Note data-testid="teach-note">{t('op.teach.note')} <StyledLink to="/chat?teach=1">{t('op.teach.public_link')} →</StyledLink></Note>
      {error && <Alert $tone="error" style={{ marginTop: 16 }} role="alert">{error}</Alert>}
      {notice && <Alert $tone="success" style={{ marginTop: 16 }} data-testid="teach-notice">{notice}</Alert>}

      {/* ---------------------------------------------------------------- settings */}
      <SubTitle $mt={40}>{t('op.teach.settings.title')}</SubTitle>
      <Description>{t('op.teach.settings.desc')}</Description>
      {trainer && eff && (
        <Muted style={{ display: 'block', marginTop: 8 }} data-testid="teach-trainer">
          {t('op.teach.settings.trainer')}: <Chip $tone={trainer.state === 'ready' ? 'ok' : trainer.state === 'busy' ? 'busy' : 'warn'}>{t(`op.teach.settings.trainer.${trainer.state}`)}</Chip>
          {trainer.reason ? ` — ${trainer.reason}` : ''} · {t('op.teach.settings.backend', { backend: eff.backend })} {eff.backend === 'stub' ? t('op.teach.settings.backend.stub') : ''}
        </Muted>
      )}
      {form && (
        <SettingsForm onSubmit={onSave} data-testid="teach-settings">
          <Checkbox label={t('op.teach.settings.enabled')} checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} data-testid="teach-enabled" />
          <div>
            <FieldLabel>{t('op.teach.settings.publish')}</FieldLabel>
            <RadioGroup role="radiogroup" aria-label={t('op.teach.settings.publish')} data-testid="teach-publish">
              {(['review', 'auto', 'never'] as const).map((o) => (
                <label key={o}><input type="radio" name="teach-publish" value={o} checked={form.publish === o} onChange={() => setForm({ ...form, publish: o })} />{t(`op.teach.settings.publish.${o}`)}</label>
              ))}
            </RadioGroup>
          </div>
          <Grid>
            <TextField type="number" min={1} max={8} label={t('op.teach.settings.facts')} value={form.facts} onChange={(e) => setForm({ ...form, facts: num(e.target.value, 1, 8) })} data-testid="teach-facts" />
            <TextField type="number" min={0} max={1000} label={t('op.teach.settings.per_key')} value={form.perKey} onChange={(e) => setForm({ ...form, perKey: num(e.target.value, 0, 1000) })} data-testid="teach-per-key" />
            <TextField type="number" min={0} max={1000} label={t('op.teach.settings.per_ip')} value={form.perIp} onChange={(e) => setForm({ ...form, perIp: num(e.target.value, 0, 1000) })} data-testid="teach-per-ip" />
            <TextField type="number" min={1} max={100} label={t('op.teach.settings.queue')} value={form.queue} onChange={(e) => setForm({ ...form, queue: num(e.target.value, 1, 100) })} data-testid="teach-queue-max" />
            <TextField type="number" min={1} max={90} label={t('op.teach.settings.ttl')} value={form.ttl} onChange={(e) => setForm({ ...form, ttl: num(e.target.value, 1, 90) })} data-testid="teach-ttl" />
          </Grid>
          <Stack $gap={6}>
            <FieldLabel>{t('op.teach.settings.share')}: <strong style={{ color: '#333' }} data-testid="teach-share-value">{form.share}%</strong></FieldLabel>
            <Slider type="range" min={0} max={90} step={5} value={form.share} aria-label={t('op.teach.settings.share')} onChange={(e) => setForm({ ...form, share: Number(e.target.value) })} data-testid="teach-share" />
            <Muted>{t('op.teach.settings.share.helper')}</Muted>
          </Stack>
          <TextField label={t('op.teach.settings.paused')} helper={t('op.teach.settings.paused.helper')} placeholder={t('op.teach.settings.paused.ph')} value={form.paused} maxLength={200} onChange={(e) => setForm({ ...form, paused: e.target.value })} data-testid="teach-paused" />
          <TextField label={t('op.teach.settings.blocked')} helper={t('op.teach.settings.blocked.helper')} value={form.blocked} maxLength={500} onChange={(e) => setForm({ ...form, blocked: e.target.value })} data-testid="teach-blocked" />
          <Row $gap={12}>
            <Button type="submit" variant="contained" disabled={!dirty} loading={updateState.isLoading} loadingText={t('op.saving')} data-testid="teach-save">{t('op.teach.settings.save')}</Button>
          </Row>
        </SettingsForm>
      )}

      {/* ---------------------------------------------------------------- queue */}
      <SubTitle $mt={56}>{t('op.teach.queue.title')}{pendingReview > 0 && <Chip $tone="warn" style={{ marginLeft: 12, verticalAlign: 'middle' }} data-testid="teach-review-count">{t('op.teach.queue.review_count', { n: pendingReview })}</Chip>}</SubTitle>
      <Description>{t('op.teach.queue.desc')}</Description>
      <TableWrapper style={{ marginTop: 16 }}>
        <Table data-testid="teach-queue">
          <TableHeader>
            <TableRow>
              <TableHead $align="left" $padding="0 0 0 24px">{t('op.teach.queue.col.lesson')}</TableHead>
              <TableHead $align="left">{t('op.teach.queue.col.contributor')}</TableHead>
              <TableHead>{t('op.teach.queue.col.facts')}</TableHead>
              <TableHead $align="left">{t('op.teach.queue.col.status')}</TableHead>
              <TableHead>{t('op.teach.queue.col.started')}</TableHead>
              <TableHead $align="left">{t('op.teach.queue.col.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((j) => {
              const busy = (approveState.isLoading && approveState.originalArgs === j.id) || (rejectState.isLoading && rejectState.originalArgs?.id === j.id) || (cancelState.isLoading && cancelState.originalArgs === j.id);
              return (
                <TableRow key={j.id} data-testid="teach-job" data-job-id={j.id} data-status={j.status}>
                  <TableData $align="left" $padding="8px 0 8px 24px" $maxWidth="320px">
                    <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={lessonName(j)}>{lessonName(j)}</strong>
                    <SubText title={j.id}>{shortHash(j.id, 8)}{j.patch_id ? ` · ${j.patch_id}` : ''}</SubText>
                  </TableData>
                  <TableData $align="left" $maxWidth="220px">
                    <Link to={`/teacher/${j.contributor.address}`} style={{ color: '#8b3eeb', textDecoration: 'none' }}>{j.contributor.name || shortAddr(j.contributor.address)}</Link>
                    <SubText title={j.contributor.address}>{shortAddr(j.contributor.address, 8)}{j.ip ? ` · ${j.ip}` : ''}</SubText>
                  </TableData>
                  <TableData>{j.facts?.length ?? '—'}</TableData>
                  <TableData $align="left" $maxWidth="260px">
                    <Row $gap={6}>{ACTIVE.has(j.status) && <SmallSpinner />}<Chip $tone={statusTone(j.status)}>{statusLabel(j)}</Chip></Row>
                    {j.checks?.executed && <SubText>{t('op.teach.queue.checks', { taught: `${j.checks.taught.hits}/${j.checks.taught.total}`, locality: `${j.checks.locality.same}/${j.checks.locality.total}` })}</SubText>}
                    {j.status === 'REJECTED' && j.reject_reason && <SubText data-testid="teach-job-reason">{t('op.teach.queue.declined_reason', { reason: j.reject_reason })}</SubText>}
                    {j.error && <SubText style={{ color: '#a0102c' }}>{t('op.teach.queue.error', { error: j.error })}</SubText>}
                  </TableData>
                  <TableData title={j.started_at ? dateTime(j.started_at) : ''}>{j.started_at ? elapsed(j.started_at) : t('op.teach.queue.not_started')}</TableData>
                  <TableData $align="left">
                    {j.status === 'PENDING_REVIEW' && declining !== j.id && (
                      <Row $gap={6}>
                        <Button size="small" variant="contained" loading={busy} onClick={() => run(() => approve(j.id).unwrap())} data-testid="teach-approve">{t('op.teach.queue.approve')}</Button>
                        <Button size="small" color="secondary" disabled={busy} onClick={() => { setDeclining(j.id); setReason(''); }} data-testid="teach-decline">{t('op.teach.queue.decline')}</Button>
                      </Row>
                    )}
                    {j.status === 'PENDING_REVIEW' && declining === j.id && (
                      <ReasonRow>
                        <TextField label={t('op.teach.queue.reason')} placeholder={t('op.teach.queue.reason.ph')} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} data-testid="teach-decline-reason" />
                        <Button size="small" color="secondary" variant="contained" disabled={!reason.trim()} loading={busy} onClick={() => run(async () => { await reject({ id: j.id, reason: reason.trim() }).unwrap(); setDeclining(null); })} data-testid="teach-decline-confirm">{t('op.teach.queue.confirm_decline')}</Button>
                        <Button size="small" variant="text" color="default" onClick={() => setDeclining(null)}>{t('common.cancel')}</Button>
                      </ReasonRow>
                    )}
                    {ACTIVE.has(j.status) && <Button size="small" color="secondary" loading={busy} onClick={() => run(() => cancel(j.id).unwrap())} data-testid="teach-cancel">{t('op.teach.queue.cancel')}</Button>}
                    {j.status === 'ANNOUNCED' && j.patch_id && <StyledLink to={`/${encodeURIComponent(nodeAddress)}/${encodeURIComponent(j.patch_id)}`}>{t('op.teach.queue.knowledge')} →</StyledLink>}
                  </TableData>
                </TableRow>
              );
            })}
            {items.length === 0 && <TableRowEmpty $height={120}><td colSpan={6}>{jobs.isLoading ? <SmallSpinner /> : t('op.teach.queue.empty')}</td></TableRowEmpty>}
          </TableBody>
        </Table>
      </TableWrapper>

      {/* ---------------------------------------------------------------- contributors */}
      <SubTitle $mt={56}>{t('op.teach.contrib.title')}</SubTitle>
      <Description>{t('op.teach.contrib.desc')}</Description>
      <TableWrapper style={{ marginTop: 16 }}>
        <Table data-testid="teach-contributors">
          <TableHeader>
            <TableRow>
              <TableHead $align="left" $padding="0 0 0 24px">{t('op.teach.contrib.col.who')}</TableHead>
              <TableHead>{t('op.teach.contrib.col.lessons')}</TableHead>
              <TableHead>{t('op.teach.contrib.col.published')}</TableHead>
              <TableHead>{t('op.teach.contrib.col.first_seen')}</TableHead>
              <TableHead $align="left">{t('op.teach.contrib.col.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(contributors.data?.items ?? []).map((c) => {
              const keyBan = banOf('address', c.address);
              const ip = ipOf.get(c.address.toLowerCase());
              const ipBan = ip ? banOf('ip', ip) : undefined;
              const busy = (hiddenState.isLoading && hiddenState.originalArgs?.address === c.address) || (addBanState.isLoading && addBanState.originalArgs?.value.toLowerCase() === c.address.toLowerCase());
              return (
                <TableRow key={c.address} data-testid="teach-contributor" data-address={c.address.toLowerCase()}>
                  <TableData $align="left" $padding="8px 0 8px 24px" $maxWidth="320px">
                    <Row $gap={8}>
                      <strong>{c.name || t('op.teach.contrib.anon')}</strong>
                      {c.hidden && <Chip $tone="muted" data-testid="contrib-hidden">{t('op.teach.contrib.hidden')}</Chip>}
                      {(keyBan || ipBan) && <Chip $tone="bad" data-testid="contrib-blocked">{t('op.teach.contrib.blocked')}</Chip>}
                    </Row>
                    <SubText><Mono title={c.address}>{shortAddr(c.address, 10)}</Mono> · <Link to={`/teacher/${c.address}`} style={{ color: '#8b3eeb' }}>{t('op.teach.contrib.page')}</Link>{ip ? ` · ${ip}` : ''}</SubText>
                  </TableData>
                  <TableData>{c.jobs}</TableData>
                  <TableData>{c.published}</TableData>
                  <TableData title={dateTime(c.first_seen)}>{elapsed(c.first_seen)}</TableData>
                  <TableData $align="left">
                    <Row $gap={6} $wrap>
                      <Button size="small" loading={hiddenState.isLoading && hiddenState.originalArgs?.address === c.address} onClick={() => run(() => setHidden({ address: c.address, hidden: !c.hidden }).unwrap())} data-testid="contrib-toggle-hidden">{c.hidden ? t('op.teach.contrib.show') : t('op.teach.contrib.hide')}</Button>
                      {keyBan
                        ? <Button size="small" color="default" loading={deleteBanState.isLoading && deleteBanState.originalArgs === keyBan.id} onClick={() => run(() => deleteBan(keyBan.id).unwrap())} data-testid="contrib-unblock-key">{t('op.teach.contrib.unblock')}</Button>
                        : <Button size="small" color="secondary" loading={busy} onClick={() => { if (window.confirm(t('op.teach.bans.confirm', { value: shortAddr(c.address, 8) }))) void run(() => addBan({ kind: 'address', value: c.address, reason: banReason.trim() || undefined }).unwrap()); }} data-testid="contrib-block-key">{t('op.teach.contrib.block_key')}</Button>}
                      {ip && (ipBan
                        ? <Button size="small" color="default" loading={deleteBanState.isLoading && deleteBanState.originalArgs === ipBan.id} onClick={() => run(() => deleteBan(ipBan.id).unwrap())} data-testid="contrib-unblock-ip">{t('op.teach.contrib.unblock')} IP</Button>
                        : <Button size="small" color="secondary" onClick={() => { if (window.confirm(t('op.teach.bans.confirm', { value: ip }))) void run(() => addBan({ kind: 'ip', value: ip, reason: banReason.trim() || undefined }).unwrap()); }} data-testid="contrib-block-ip">{t('op.teach.contrib.block_ip')}</Button>)}
                      {!ip && <Muted title={t('op.teach.contrib.no_ip')}>{t('op.teach.contrib.block_ip')}: {t('op.teach.contrib.no_ip')}</Muted>}
                    </Row>
                  </TableData>
                </TableRow>
              );
            })}
            {(contributors.data?.items ?? []).length === 0 && <TableRowEmpty $height={100}><td colSpan={5}>{contributors.isLoading ? <SmallSpinner /> : t('op.teach.contrib.empty')}</td></TableRowEmpty>}
          </TableBody>
        </Table>
      </TableWrapper>
      <Row $gap={12} $align="flex-end" style={{ marginTop: 12, maxWidth: 560 }}>
        <TextField label={t('op.teach.bans.reason')} value={banReason} maxLength={500} onChange={(e) => setBanReason(e.target.value)} />
      </Row>
      <strong style={{ display: 'block', marginTop: 24, fontSize: 14 }}>{t('op.teach.bans.title')}</strong>
      <TableWrapper style={{ marginTop: 8, maxWidth: 760 }}>
        <Table data-testid="teach-bans">
          <TableBody>
            {(bans.data?.items ?? []).map((b) => (
              <TableRow key={b.id} data-testid="teach-ban" data-kind={b.kind} data-value={b.value.toLowerCase()}>
                <TableData $align="left" $padding="8px 0 8px 24px"><Chip $tone="bad">{t(`op.teach.bans.kind.${b.kind}`)}</Chip> <Mono>{b.value}</Mono></TableData>
                <TableData $align="left">{b.reason || '—'}</TableData>
                <TableData title={dateTime(b.ts)}>{elapsed(b.ts)}</TableData>
                <TableData><Button size="small" variant="text" color="secondary" loading={deleteBanState.isLoading && deleteBanState.originalArgs === b.id} onClick={() => run(() => deleteBan(b.id).unwrap())} data-testid="ban-remove">{t('op.teach.contrib.unblock')}</Button></TableData>
              </TableRow>
            ))}
            {(bans.data?.items ?? []).length === 0 && <TableRowEmpty $height={60}><td colSpan={4}>{t('op.teach.bans.empty')}</td></TableRowEmpty>}
          </TableBody>
        </Table>
      </TableWrapper>

      {/* ---------------------------------------------------------------- payouts */}
      <SubTitle $mt={56}>{t('op.teach.payouts.title')}</SubTitle>
      <Description>{t('op.teach.payouts.desc', { n: payouts.data?.max_attempts ?? 20 })}</Description>
      {payouts.isLoading ? <CenterProgress /> : payouts.data && (
        <>
          <Tiles data-testid="teach-payouts-summary">
            <Tile $tone="warn"><div className="k">{t('op.teach.payouts.owed')}</div><div className="v" data-testid="payouts-owed">{payouts.data.summary.pending}</div></Tile>
            <Tile $tone="ok"><div className="k">{t('op.teach.payouts.paid')}</div><div className="v" data-testid="payouts-paid">{payouts.data.summary.paid}</div></Tile>
            <Tile $tone="bad"><div className="k">{t('op.teach.payouts.failed')}</div><div className="v" data-testid="payouts-failed">{payouts.data.summary.failed}</div></Tile>
          </Tiles>
          {!payouts.data.wallet && <Alert $tone="info" style={{ marginTop: 12, maxWidth: 760 }} data-testid="payouts-no-wallet">{t('op.teach.payouts.no_wallet')}</Alert>}
          <TableWrapper style={{ marginTop: 16 }}>
            <Table data-testid="teach-payouts">
              <TableHeader>
                <TableRow>
                  <TableHead $align="left" $padding="0 0 0 24px">{t('op.knowledge')}</TableHead>
                  <TableHead $align="left">{t('op.teach.payouts.col.to')}</TableHead>
                  <TableHead>{t('op.teach.payouts.col.amount')}</TableHead>
                  <TableHead>{t('op.teach.payouts.col.status')}</TableHead>
                  <TableHead>{t('op.teach.payouts.col.tries')}</TableHead>
                  <TableHead>{t('op.teach.payouts.col.when')}</TableHead>
                  <TableHead $align="left">{t('op.teach.payouts.col.tx')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.data.items.map((p) => (
                  <TableRow key={p.id} data-testid="teach-payout" data-status={p.status}>
                    <TableData $align="left" $padding="8px 0 8px 24px"><StyledLink to={`/${encodeURIComponent(nodeAddress)}/${encodeURIComponent(p.patch_id)}`}>{p.patch_id}</StyledLink><SubText title={p.settle_hash}>{shortHash(p.settle_hash, 10)}</SubText></TableData>
                    <TableData $align="left"><Link to={`/teacher/${p.address}`} style={{ color: '#8b3eeb' }} title={p.address}>{shortAddr(p.address, 8)}</Link></TableData>
                    <TableData title={money.note(p.currency || currency)}>{money.fmt(p.amount, p.currency || currency)}</TableData>
                    <TableData><Chip $tone={payoutTone(p.status)}>{t(`op.teach.payouts.status.${p.status}`)}</Chip></TableData>
                    <TableData>{p.attempts}{payouts.data && p.status !== 'paid' ? ` / ${payouts.data.max_attempts}` : ''}</TableData>
                    <TableData title={dateTime(p.updated_at)}>{elapsed(p.updated_at)}</TableData>
                    <TableData $align="left" $maxWidth="260px">{p.tx_hash ? <Mono title={p.tx_hash}>{shortHash(p.tx_hash, 12)}</Mono> : p.last_error ? <span style={{ color: '#a0102c', fontSize: 12 }}>{p.last_error}</span> : '—'}</TableData>
                    <TableData>{p.status !== 'paid' && <Button size="small" loading={retryState.isLoading && retryState.originalArgs === p.id} onClick={() => run(() => retryPayout(p.id).unwrap(), t('op.teach.payouts.retried'))} data-testid="payout-retry">{t('op.teach.payouts.retry')}</Button>}</TableData>
                  </TableRow>
                ))}
                {payouts.data.items.length === 0 && <TableRowEmpty $height={100}><td colSpan={8}>{t('op.teach.payouts.empty')}</td></TableRowEmpty>}
              </TableBody>
            </Table>
          </TableWrapper>
        </>
      )}
    </div>
  );
}
