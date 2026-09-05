import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router';
import styled from 'styled-components';
import { api, errorMessage, useBranchesQuery, useCatalogQuery, useCreatePatchMutation, useInfoQuery } from '@/api/api';
import type { PatchAnchor } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { Button } from '@/components/ui/Button';
import { Alert, FormRow, SelectField, TextArea, TextField } from '@/components/ui/Form';
import { Description, PageWrapper, StyledLink, SubTitle, Title, TitleRow } from '@/components/ui/Misc';
import { DevBox, Muted, Row, Stack, Tip, useMoney } from '@/components/operator/common';

const Form = styled.form`display: flex; flex-direction: column; gap: 24px; max-width: 760px;`;
const Textarea = styled.textarea`
  width: 100%; min-height: 200px; padding: 12px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 4px; font-family: ${(p) => p.theme.font.mono}; font-size: 12px; line-height: 1.5; resize: vertical;
  &:focus { outline: none; border-color: #8b3eeb; }
`;
const SampleRow = styled.div`display: grid; grid-template-columns: 1fr 160px auto; gap: 12px; align-items: end;`;
const Choice = styled.div`
  display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;
`;
const ChoiceCard = styled.label<{ $active: boolean }>`
  display: flex; flex-direction: column; gap: 10px; padding: 16px; border: 1px solid ${(p) => (p.$active ? p.theme.color.PRIMARY : p.theme.color.LIGHT_GREY)}; background: ${(p) => (p.$active ? '#faf7ff' : '#fff')}; cursor: pointer;
  input[type='radio'] { accent-color: #8b3eeb; }
`;
const FileInput = styled.input`font-size: 13px;`;
/** Finding 100 — the character counter beside the description helper, in the same face the live-test composer uses. */
const DescCount = styled.span<{ $full: boolean }>`
  white-space: nowrap; font-variant-numeric: tabular-nums;
  color: ${(p) => (p.$full ? '#a0102c' : 'inherit')}; font-weight: ${(p) => (p.$full ? 600 : 400)};
`;
const FieldLabel = styled.span`font-size: 12px; color: #8d8d8f; font-weight: 500;`;
/** Consequence of what is being typed, in the info tone the Alert already uses — money, licence and lineage. */
const Hint = styled.div<{ $tone?: 'info' | 'warning' }>`
  margin-top: -10px; padding: 10px 12px; border-radius: 4px; font-size: 13px; line-height: 1.55;
  display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px;
  ${(p) => (p.$tone === 'warning' ? 'background:#fff3e0;color:#8a4b00;' : 'background:#f5eefc;color:#5b1ca8;')}
`;
const Bar = styled.div`width: 100%; height: 8px; border-radius: 4px; background: #e7e0f3; overflow: hidden;`;
const BarFill = styled.div<{ $pct: number }>`height: 100%; width: ${(p) => Math.max(0, Math.min(100, p.$pct))}%; background: ${(p) => p.theme.color.PRIMARY}; transition: width 0.2s linear;`;

interface Sample { prompt: string; expect: string }
interface Bench { schema: string; queries: number; format: string[]; collateral_bound_nat?: number; samples: Sample[]; [k: string]: unknown }
/**
 * Item 165: `collateral_bound_nat` used to sit here at 0.1 — a public technical claim the form chose and the
 * publisher never saw, looser than the 0.08 the product's own reference uses. It is a real, optional field now,
 * and an unset limit is published as unset.
 */
const DEFAULT_BENCH: Bench = { schema: '', queries: 0, format: ['template'], samples: [{ prompt: '', expect: '' }] };

/** The five identifiers the teach publish sheet offers, plus this node's own terms and a free-text escape (item 161). */
const LICENSES = ['CC-BY-4.0', 'CC-BY-SA-4.0', 'CC0-1.0', 'ODC-By-1.0', 'Proprietary'] as const;
const LICENSE_LABEL: Record<string, string> = {
  'CC-BY-4.0': 'op.new.license.opt.cc_by', 'CC-BY-SA-4.0': 'op.new.license.opt.cc_by_sa', 'CC0-1.0': 'op.new.license.opt.cc0',
  'ODC-By-1.0': 'op.new.license.opt.odc_by', Proprietary: 'op.new.license.opt.proprietary',
};

/**
 * Finding 100 — the description is the largest block of prose on a browse card and is clamped to two lines there,
 * and the descriptions this network carries spent them on an absolute path and an optimiser setting. The card side
 * is handled by `lib/describe.ts`; this is the other half the finding asked for, on the form that writes them: a
 * ceiling, a counter that appears before it is reached, and helper text saying what those two lines are for.
 * 1,000 is a deliberate ceiling rather than the node's (the node has none) — long enough for a full description of
 * a knowledge and its benchmark, short enough that nobody pastes a training log into it.
 */
const DESCRIPTION_MAX = 1000;
const DESCRIPTION_COUNT_FROM = 700;

const DRAFT_KEY = 'ainize.new-patch.form';
interface FormDraft {
  name: string; id: string; description: string; modelId: string; priceV: string; license: string;
  parents: string; branch: string; topic: string; asOf?: string; benchText: string; source: 'upload' | 'path'; path: string;
}
const readDraft = (): FormDraft | null => {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) as FormDraft : null;
  } catch { return null; }
};

/**
 * How many memory entries the picked .npz actually holds (item 165). A .npz is a zip of .npy members: read the
 * central directory from the tail, find `addrs.npy`, and parse the shape out of its numpy header. Everything is a
 * ranged read, so a 300 MB file costs two small slices. Anything unexpected (a deflated member, zip64, a file that
 * is not an npz) returns null and the form claims nothing.
 */
async function npzRows(file: File): Promise<number | null> {
  try {
    const tailLen = Math.min(file.size, 66_000);
    const tail = new DataView(await file.slice(file.size - tailLen, file.size).arrayBuffer());
    let eocd = -1;
    for (let i = tail.byteLength - 22; i >= 0; i--) if (tail.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) return null;
    const cdSize = tail.getUint32(eocd + 12, true);
    const cdOffset = tail.getUint32(eocd + 16, true);
    if (cdOffset === 0xffffffff || cdSize === 0xffffffff) return null;      // zip64 — not worth parsing here
    const cd = new DataView(await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer());
    for (let p = 0; p + 46 <= cd.byteLength && cd.getUint32(p, true) === 0x02014b50;) {
      const method = cd.getUint16(p + 10, true);
      const nameLen = cd.getUint16(p + 28, true);
      const extraLen = cd.getUint16(p + 30, true);
      const commentLen = cd.getUint16(p + 32, true);
      const localOffset = cd.getUint32(p + 42, true);
      const name = new TextDecoder().decode(new Uint8Array(cd.buffer, p + 46, nameLen));
      if (name === 'addrs.npy') {
        if (method !== 0) return null;                                      // compressed member — cannot slice it
        const lh = new DataView(await file.slice(localOffset, localOffset + 30).arrayBuffer());
        if (lh.getUint32(0, true) !== 0x04034b50) return null;
        const head = localOffset + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
        // latin1 is windows-1252 in the Encoding standard, so the magic byte 0x93 decodes to a curly quote, not
        // U+0093 — match the five letters after it rather than the byte.
        const npy = new TextDecoder('latin1').decode(await file.slice(head, head + 256).arrayBuffer());
        if (npy.slice(1, 6) !== 'NUMPY') return null;
        const shape = /'shape':\s*\((\d+)/.exec(npy);
        return shape ? Number(shape[1]) : null;
      }
      p += 46 + nameLen + extraLen + commentLen;
    }
    return null;
  } catch { return null; }
}

export default function NewPatchPage() {
  const { t, term, help, tech } = useT();
  useTitle(t('op.new.title'));
  const money = useMoney();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { address } = useAuth();
  const { data: info } = useInfoQuery();
  const catalog = useCatalogQuery({ limit: 200 });
  /** Item 169(c): the tracks that actually exist, so a typed name is checked against them before publishing. */
  const tracks = useBranchesQuery();
  const currency = info?.currency ?? 'CREDIT';
  const [create, state] = useCreatePatchMutation();

  // Item 95: everything typed here survives a refresh (sessionStorage, this tab only) — a 300 MB upload is minutes
  // long and the form used to be thrown away by a stray navigation.
  const [saved] = useState(readDraft);
  const [name, setName] = useState(saved?.name ?? '');
  const [id, setId] = useState(saved?.id ?? '');
  const [description, setDescription] = useState(saved?.description ?? '');
  const [modelId, setModelId] = useState(saved?.modelId ?? info?.runtime.model ?? 'Qwen3.8-Flash-Next');
  const [priceV, setPriceV] = useState(saved?.priceV ?? '0.1');
  const [licenseChoice, setLicenseChoice] = useState(() => (!saved?.license ? '' : LICENSES.includes(saved.license as typeof LICENSES[number]) ? saved.license : 'other'));
  const [licenseOther, setLicenseOther] = useState(() => (saved?.license && !LICENSES.includes(saved.license as typeof LICENSES[number]) ? saved.license : ''));
  const [parents, setParents] = useState(saved?.parents ?? '');
  const [branch, setBranch] = useState(saved?.branch ?? '');
  /** Item 267 — the day the DATA is true of, which until now lived only in whatever name the publisher typed. */
  const [asOf, setAsOf] = useState(saved?.asOf ?? '');
  const [topic, setTopic] = useState(saved?.topic ?? '');
  // benchmark: `bench` is the source of truth for the plain fields; `benchText` is the developer JSON view kept in sync both ways.
  const [bench, setBench] = useState<Bench>(() => {
    if (!saved?.benchText) return DEFAULT_BENCH;
    try { return { ...DEFAULT_BENCH, ...JSON.parse(saved.benchText) as Bench }; } catch { return DEFAULT_BENCH; }
  });
  const [benchText, setBenchText] = useState(saved?.benchText ?? JSON.stringify(DEFAULT_BENCH, null, 2));
  const [benchError, setBenchError] = useState<string | null>(null);
  const [source, setSource] = useState<'upload' | 'path'>(saved?.source ?? 'upload');
  const [file, setFile] = useState<File | null>(null);
  const [fileRows, setFileRows] = useState<number | null>(null);
  const [path, setPath] = useState(saved?.path ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(saved ? t('op.new.draft.restored') : null);   // item 95: the form survived a refresh
  // upload progress (measured from XHR upload events, never guessed)
  const [sent, setSent] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'sending' | 'server'>('idle');
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const startedAt = useRef(0);

  /**
   * Item 157 — a REJECTED knowledge is a dead end: its id is burned, its record is permanent, and the only way
   * forward is a corrected version that declares it as a parent. The manage page sends the publisher here with
   * `?from=<id>`, and this fills the form from that anchor once — name, description, price, model, benchmark,
   * track and topic — with a fresh id suggested and the rejected one already in Origins, so the lineage and the
   * work survive the rejection. Only ever applied to an untouched form: a restored draft (item 95) wins.
   */
  const [sp] = useSearchParams();
  const from = sp.get('from');
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || saved || !from) return;
    const e = catalog.data?.items.find((x) => x.anchor.id === from);
    if (!e) return;
    prefilled.current = true;
    const a = e.anchor;
    setName(a.name ?? '');
    setId(`${a.id}-v2`.slice(0, 64));
    setDescription(a.description ?? '');
    setModelId(a.model.id_M);
    setPriceV(a.price);
    setParents(a.id);
    setBranch(a.branch ?? '');
    setTopic(a.topic_path ?? '');
    setAsOf((a as { as_of?: string }).as_of ?? '');
    const b: Bench = {
      schema: a.benchmark.schema, queries: a.benchmark.queries,
      format: a.benchmark.format ?? [], collateral_bound_nat: a.benchmark.collateral_bound_nat,
      samples: (a.benchmark.samples ?? []).slice(0, 3).map((x) => ({ prompt: x.prompt, expect: x.expect })),
    };
    setBench(b);
    setBenchText(JSON.stringify(b, null, 2));
    setNotice(t('op.new.from.notice', { id: a.id }));
  }, [from, saved, catalog.data, t]);

  const license = licenseChoice === 'other' ? licenseOther : licenseChoice;

  // Only a form somebody has actually started is kept: an untouched visit must not greet the next one with a
  // "we brought back what you typed" notice over an empty page.
  const started = !!(name || id || description || parents || branch || topic || asOf || path || license || bench.schema || bench.queries || bench.samples.some((x) => x.prompt || x.expect) || priceV !== '0.1');
  useEffect(() => {
    const draft: FormDraft = { name, id, description, modelId, priceV, license, parents, branch, topic, asOf, benchText, source, path };
    const timer = setTimeout(() => {
      try { if (started) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); else sessionStorage.removeItem(DRAFT_KEY); } catch { /* private mode — the form still works */ }
    }, 400);
    return () => clearTimeout(timer);
  }, [started, name, id, description, modelId, priceV, license, parents, branch, topic, asOf, benchText, source, path]);

  const updateBench = (patch: Partial<Bench>) => {
    const next: Bench = { ...bench, ...patch };
    const filled = next.samples.filter((s) => s.prompt).length;
    if (!next.queries || next.queries < filled) next.queries = filled;
    if (next.collateral_bound_nat === undefined) delete next.collateral_bound_nat;
    setBench(next); setBenchText(JSON.stringify(next, null, 2)); setBenchError(null);
  };
  const onJson = (text: string) => {
    setBenchText(text);
    try {
      const parsed = JSON.parse(text) as Partial<Bench>;
      const samples = Array.isArray(parsed.samples) ? parsed.samples.map((s) => ({ prompt: String(s.prompt ?? ''), expect: String(s.expect ?? '') })) : [];
      setBench({ ...DEFAULT_BENCH, ...parsed, schema: String(parsed.schema ?? ''), queries: Number(parsed.queries ?? 0) || 0, samples: samples.length ? samples : [{ prompt: '', expect: '' }] });
      setBenchError(null);
    } catch (e) { setBenchError(t('op.manage.bench.invalid', { message: (e as Error).message })); }
  };
  const samples = bench.samples;
  const setSamples = (next: Sample[]) => updateBench({ samples: next });

  const nf = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 6 });
  const slugPreview = (id || name).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
  const mb = (bytes: number) => (bytes / 1e6).toFixed(1);

  const items = useMemo(() => catalog.data?.items ?? [], [catalog.data]);

  /** Item 162 — what knowledge actually sells for on this node, from the catalogue every buyer already sees. */
  const market = useMemo(() => {
    const prices = items.map((e) => Number(e.anchor.price)).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
    if (!prices.length) return null;
    const mid = prices.length % 2 ? prices[(prices.length - 1) / 2] : (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2;
    return { min: prices[0], max: prices[prices.length - 1], median: mid, n: prices.length };
  }, [items]);
  /** The item on the same subject this one would replace — its price is the number the publisher meant to match. */
  const sameSubject = useMemo(() => {
    const schema = bench.schema.trim().toLowerCase();
    if (!schema) return null;
    return items
      .filter((e) => e.anchor.benchmark.schema.toLowerCase() === schema && ['LISTED', 'VERIFYING', 'ANNOUNCED'].includes(e.status))
      .sort((a, b) => b.anchor.created_at - a.anchor.created_at)[0] ?? null;
  }, [items, bench.schema]);

  /**
   * Item 163 — naming a source knowledge hands over a share of every future sale, and the rate lived only on the
   * buyer's page. This is the rule the node applies at publish: this node's share, floored by what each named
   * parent already promised on the record (a child may promise more, never less).
   */
  const lineage = useMemo(() => {
    const ids = parents.split(',').map((s) => s.trim()).filter(Boolean);
    if (!ids.length) return null;
    const byId = new Map(items.map((e) => [e.anchor.id, e]));
    const unknown = ids.filter((x) => !byId.has(x));
    let share = info?.royalty_share ?? 0.3;
    let from: string | null = null;
    for (const x of ids) {
      const s = byId.get(x)?.anchor.royalty_share;
      if (typeof s === 'number' && s > share) { share = s; from = x; }
    }
    return { n: ids.length, unknown, pct: Math.round(share * 100), keep: Math.round((1 - share) * 100), from };
  }, [parents, items, info?.royalty_share]);

  const eta = (): string | null => {
    const ms = Date.now() - startedAt.current;
    if (!sent || ms < 1500 || sent >= totalBytes) return null;
    const left = ((totalBytes - sent) / (sent / ms)) / 1000;
    return left > 90 ? t('op.new.upload.eta.min', { n: Math.ceil(left / 60) }) : t('op.new.upload.eta.sec', { n: Math.max(1, Math.round(left)) });
  };

  const pickFile = (f: File | null) => {
    setFile(f); setFileRows(null);
    if (f) void npzRows(f).then(setFileRows);
  };

  const clearDraft = () => { try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* nothing to clear */ } };
  const startOver = () => {
    clearDraft();
    setName(''); setId(''); setDescription(''); setPriceV('0.1'); setLicenseChoice(''); setLicenseOther('');
    setParents(''); setBranch(''); setTopic(''); setPath(''); pickFile(null);
    setBench(DEFAULT_BENCH); setBenchText(JSON.stringify(DEFAULT_BENCH, null, 2)); setBenchError(null);
    setNotice(null); setError(null);
  };

  /** POST /api/patches with the bytes, reporting real progress and abortable — RTK Query cannot do either (item 95). */
  const uploadWithProgress = (fd: FormData) => new Promise<{ anchor: PatchAnchor }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open('POST', '/api/patches');
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) { setSent(e.loaded); setTotalBytes(e.total); if (e.loaded >= e.total) setPhase('server'); } };
    xhr.onload = () => {
      let body: unknown = null;
      try { body = JSON.parse(xhr.responseText) as unknown; } catch { /* an error page, not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as { anchor: PatchAnchor });
      else reject({ status: xhr.status, data: body ?? { error: `request failed (${xhr.status})` } });
    };
    xhr.onerror = () => reject({ status: 0, data: { error: t('op.new.err.network') } });
    xhr.onabort = () => reject({ aborted: true });
    xhr.send(fd);
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null); setNotice(null);
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(benchText); } catch (err) { setError(t('op.new.err.json', { message: (err as Error).message })); return; }
    if (!parsed.schema) { setError(t('op.new.err.schema')); return; }
    if (source === 'upload' && !file) { setError(t('op.new.err.file')); return; }
    if (source === 'path' && !path.trim()) { setError(t('op.new.err.path')); return; }
    const fd = new FormData();
    fd.set('name', name.trim());
    if (id.trim()) fd.set('id', id.trim());
    fd.set('description', description.trim());
    fd.set('model_id', modelId.trim());
    fd.set('price', priceV || '0');
    if (license.trim()) fd.set('license', license.trim());
    if (parents.trim()) fd.set('parents', parents.trim());
    if (branch.trim()) fd.set('branch', branch.trim());
    if (topic.trim()) fd.set('topic_path', topic.trim());
    if (asOf.trim()) fd.set('as_of', asOf.trim());
    fd.set('benchmark', JSON.stringify(parsed));
    if (source === 'upload' && file) fd.set('file', file); else fd.set('path', path.trim());
    setSubmitting(true);
    setSent(0); setTotalBytes(file?.size ?? 0); startedAt.current = Date.now();
    setPhase(source === 'upload' ? 'sending' : 'server');
    try {
      const res = source === 'upload' ? await uploadWithProgress(fd) : await create(fd).unwrap();
      if (source === 'upload') dispatch(api.util.invalidateTags(['Catalog', 'Me']));
      clearDraft();
      navigate(`/project/${address ?? res.anchor.author}/${res.anchor.id}`);
    } catch (err) {
      if ((err as { aborted?: boolean }).aborted) setNotice(t('op.new.upload.cancelled'));
      else setError(errorMessage(err));
    } finally {
      setSubmitting(false); setPhase('idle'); xhrRef.current = null;
    }
  };

  const pct = totalBytes ? Math.floor((sent / totalBytes) * 100) : 0;
  const left = eta();

  return (
    <PageWrapper>
      <TitleRow><Title>{t('op.new.title')}</Title></TitleRow>
      <Description title={tech('patch')}>{t('op.new.desc')}</Description>

      <Form onSubmit={onSubmit}>
        {notice && (
          <Alert $tone="info" data-testid="new-notice">
            {notice}{' '}
            <Button type="button" size="small" variant="text" onClick={startOver}>{t('op.new.draft.discard')}</Button>
          </Alert>
        )}
        <SubTitle $mt={32}>{t('op.new.sec.basic')}</SubTitle>
        <FormRow>
          <TextField label={t('op.new.name')} placeholder={t('op.new.name.ph')} value={name} onChange={(e) => setName(e.target.value)} required />
          <TextField label={t('op.new.id')} placeholder="krx-all-2761" value={id} onChange={(e) => setId(e.target.value)} helper={slugPreview ? t('op.new.id.helper.preview', { slug: slugPreview }) : t('op.new.id.helper.empty')} />
        </FormRow>
        <TextArea label={t('op.new.description')} placeholder={t('op.new.description.ph')} value={description} maxLength={DESCRIPTION_MAX}
          onChange={(e) => setDescription(e.target.value)}
          helper={<>{t('op.new.description.helper')}{description.length >= DESCRIPTION_COUNT_FROM && (
            <> <DescCount $full={description.length >= DESCRIPTION_MAX} data-testid="new-description-count">
              {description.length >= DESCRIPTION_MAX ? t('op.new.description.limit_hit', { max: DESCRIPTION_MAX }) : t('op.new.description.count', { n: description.length, max: DESCRIPTION_MAX })}
            </DescCount></>
          )}</>} />
        <FormRow>
          <TextField label={<Tip tech="model.id_M — target backbone + tokenizer">{t('op.new.model')}</Tip>} value={modelId} onChange={(e) => setModelId(e.target.value)} required helper={t('op.new.model.helper')} />
          <TextField label={<Tip tech="topic_path (ain-js knowledge graph)">{t('op.new.topic')}</Tip>} placeholder="finance/krx" value={topic} onChange={(e) => setTopic(e.target.value)} helper={t('op.new.topic.helper')} />
        </FormRow>
        <FormRow>
          {/* Item 267: registration time is not data time, and until now only the name string carried the day. */}
          <TextField type="date" label={<Tip tech="anchor.as_of (YYYY-MM-DD)">{t('op.new.as_of')}</Tip>} value={asOf} onChange={(e) => setAsOf(e.target.value)} helper={t('op.new.as_of.helper')} data-testid="new-as-of" />
        </FormRow>

        <SubTitle $mt={24}>{t('op.new.sec.price')}</SubTitle>
        <FormRow>
          <TextField label={<Tip tech={tech('autoPay')}>{t('op.new.price', { unit: money.unit(currency) })}</Tip>} type="number" min={0} step="0.000001" value={priceV} onChange={(e) => setPriceV(e.target.value)}
            helper={<>{t('op.new.price.helper')} <br />{money.note(currency)}</>} />
          <SelectField label={t('op.new.license')} value={licenseChoice} helper={t('op.new.license.helper')} data-testid="new-license"
            onChange={(e) => setLicenseChoice(e.target.value)}>
            <option value="">{t('op.new.license.opt.default')}</option>
            {LICENSES.map((l) => <option key={l} value={l}>{t(LICENSE_LABEL[l])}</option>)}
            <option value="other">{t('op.new.license.opt.other')}</option>
          </SelectField>
        </FormRow>
        <Hint data-testid="new-price-market">
          <span>{market ? t('op.new.price.market', { min: nf(market.min), max: nf(market.max), median: nf(market.median), unit: money.unit(currency), n: market.n }) : t('op.new.price.market.none')}</span>
          {sameSubject && (
            <>
              <span>{t('op.new.price.same', { schema: sameSubject.anchor.benchmark.schema, name: sameSubject.anchor.name, price: money.fmt(sameSubject.anchor.price, sameSubject.anchor.currency) })}</span>
              <Button type="button" size="small" variant="text" data-testid="use-same-price" onClick={() => setPriceV(sameSubject.anchor.price)}>{t('op.new.price.same.use')}</Button>
            </>
          )}
        </Hint>
        {licenseChoice === 'other' ? (
          <TextField label={t('op.new.license.other')} placeholder={t('op.new.license.other.ph')} value={licenseOther} data-testid="new-license-other"
            onChange={(e) => setLicenseOther(e.target.value)} />
        ) : licenseChoice === '' ? (
          <Hint data-testid="new-license-default">{t('op.new.license.default', { terms: t('detail.ov.license_default') })}</Hint>
        ) : null}
        <FormRow>
          <TextField label={<Tip tech={tech('lineage')}>{t('op.new.parents')}</Tip>} placeholder="pixelplus-087600, krx-all-2761" value={parents} onChange={(e) => setParents(e.target.value)} helper={t('op.new.parents.helper')} />
          <TextField label={<Tip tech={tech('branch')}>{t('op.new.branch')}</Tip>} placeholder="law/KR" value={branch} onChange={(e) => setBranch(e.target.value)} helper={t('op.new.branch.helper')} list="known-tracks" />
          <datalist id="known-tracks">{(tracks.data?.branches ?? []).map((b) => <option key={b.name} value={b.name} />)}</datalist>
        </FormRow>
        {/*
          * Item 169(c) — a track name typed here (and `publish --branch` on the CLI) is written onto the anchor and
          * files into nothing: `branch ls` still says there are no tracks and the router matches none, because a
          * track exists only as its own public record. The name is not refused — the anchor keeps it — but the form
          * says what it will and will not do, and names the two ways to make the track real.
          */}
        {!!branch.trim() && !(tracks.data?.branches ?? []).some((b) => b.name === branch.trim()) && (
          <Hint $tone="warning" data-testid="new-branch-unknown">
            {t('op.new.branch.unknown', { name: branch.trim() })}{' '}
            <StyledLink to="/dashboard#tracks">{t('op.new.branch.unknown.create')} →</StyledLink>
          </Hint>
        )}
        <Hint data-testid="new-lineage-split" $tone={lineage?.unknown.length ? 'warning' : 'info'}>
          {!lineage ? t('op.new.parents.none') : (
            <>
              <span>{t('op.new.parents.split', { n: lineage.n, pct: lineage.pct, keep: lineage.keep }, lineage.n)}</span>
              {/* Item 322: and the rule that decides it — two knowledges by one creator cost what one costs. */}
              <span data-testid="new-lineage-rule">{t('op.new.parents.rule')}</span>
              {lineage.from && <span>{t('op.new.parents.split.inherited', { id: lineage.from, pct: lineage.pct })}</span>}
              {lineage.unknown.length > 0 && <span>{t('op.new.parents.unknown', { ids: lineage.unknown.join(', ') })}</span>}
            </>
          )}
        </Hint>

        <SubTitle $mt={24}>{t('op.new.sec.bench')}</SubTitle>
        <Description>{t('op.new.bench.desc')}</Description>
        <FormRow>
          <TextField label={<Tip tech="benchmark.schema">{t('op.new.schema')}</Tip>} placeholder="krx-ticker-codes" value={bench.schema} onChange={(e) => updateBench({ schema: e.target.value })} required helper={t('op.new.schema.helper')} />
          <TextField label={<Tip tech={tech('facts')}>{term('facts')}</Tip>} type="number" min={0} step={1} value={bench.queries} onChange={(e) => updateBench({ queries: Math.max(0, Number(e.target.value) || 0) })} helper={t('op.new.queries.helper')} />
        </FormRow>
        {fileRows !== null && (
          <Hint data-testid="new-facts-check" $tone={bench.queries > fileRows ? 'warning' : 'info'}>
            {bench.queries > fileRows ? (
              <>
                <span>{t('op.new.queries.over', { q: nf(bench.queries), rows: nf(fileRows) })}</span>
                <Button type="button" size="small" variant="text" onClick={() => updateBench({ queries: fileRows })}>{t('op.new.queries.use_rows', { rows: nf(fileRows) })}</Button>
              </>
            ) : <span>{t('op.new.queries.rows', { rows: nf(fileRows) })}</span>}
          </Hint>
        )}
        <FormRow>
          <TextField label={<Tip tech="benchmark.collateral_bound_nat">{t('op.new.collateral')}</Tip>} type="number" min={0} step="0.01" placeholder="0.08" data-testid="new-collateral"
            value={bench.collateral_bound_nat ?? ''} onChange={(e) => updateBench({ collateral_bound_nat: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0) })}
            helper={t('op.new.collateral.helper')} />
        </FormRow>
        <Stack $gap={10}>
          <FieldLabel title={help('accuracy')}>{t('op.new.samples')}</FieldLabel>
          {samples.map((s, i) => (
            <SampleRow key={i}>
              <TextField label={i === 0 ? t('op.new.sample.prompt') : undefined} placeholder={t('op.new.sample.prompt.ph')} value={s.prompt} onChange={(e) => setSamples(samples.map((x, j) => (j === i ? { ...x, prompt: e.target.value } : x)))} />
              <TextField label={i === 0 ? t('op.new.sample.expect') : undefined} placeholder="087600" value={s.expect} onChange={(e) => setSamples(samples.map((x, j) => (j === i ? { ...x, expect: e.target.value } : x)))} />
              <Button type="button" size="small" variant="text" color="default" disabled={samples.length === 1} onClick={() => setSamples(samples.filter((_, j) => j !== i))}>{t('op.remove')}</Button>
            </SampleRow>
          ))}
          <div><Button type="button" size="small" variant="text" onClick={() => setSamples([...samples, { prompt: '', expect: '' }])}>{t('op.new.sample.add')}</Button></div>
        </Stack>
        <DevBox style={{ marginTop: 0 }}>
          <Muted style={{ display: 'block', marginBottom: 8 }}>{t('op.new.bench.json')}</Muted>
          <Textarea value={benchText} onChange={(e) => onJson(e.target.value)} spellCheck={false} />
          {benchError && <Alert $tone="warning" style={{ marginTop: 8 }}>{benchError}</Alert>}
        </DevBox>

        <SubTitle $mt={24}>{t('op.new.sec.file')}</SubTitle>
        <Description title={tech('rows')}>{t('op.new.file.desc')}</Description>
        <Choice>
          <ChoiceCard $active={source === 'upload'}>
            <Row $gap={8}><input type="radio" name="source" checked={source === 'upload'} onChange={() => setSource('upload')} /><strong>{t('op.new.file.upload')}</strong></Row>
            <FileInput type="file" accept=".npz,application/octet-stream" disabled={source !== 'upload'} onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
            <Muted>{file ? t('op.new.file.size', { name: file.name, mb: mb(file.size) }) : t('op.new.file.upload.note')}</Muted>
          </ChoiceCard>
          <ChoiceCard $active={source === 'path'}>
            <Row $gap={8}><input type="radio" name="source" checked={source === 'path'} onChange={() => setSource('path')} /><strong>{t('op.new.file.path')}</strong></Row>
            <TextField placeholder="/srv/ainize/knowledge/my-knowledge.npz" aria-label={t('op.new.file.path')} value={path} onChange={(e) => setPath(e.target.value)} disabled={source !== 'path'} helper={t('op.new.file.path.helper')} />
            <Muted>{t('op.new.file.path.note')}</Muted>
          </ChoiceCard>
        </Choice>
        <DevBox style={{ marginTop: 0 }}><Muted>{t('op.new.dev.npz')}</Muted></DevBox>

        {error && <Alert $tone="error">{error}</Alert>}
        {submitting && source === 'upload' && file && (
          <Stack $gap={8} data-testid="upload-progress">
            <Row $gap={12} $justify="space-between">
              <strong style={{ fontSize: 14 }}>{t('op.new.uploading', { name: file.name })}</strong>
              <Button type="button" size="small" variant="text" color="default" onClick={() => xhrRef.current?.abort()}>{t('op.new.upload.cancel')}</Button>
            </Row>
            <Bar role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t('op.new.uploading', { name: file.name })}><BarFill $pct={pct} /></Bar>
            <Muted data-testid="upload-numbers">
              {t('op.new.upload.progress', { sent: mb(sent), total: mb(totalBytes || file.size), pct })}
              {left ? ` · ${t('op.new.upload.eta', { eta: left })}` : ''}
            </Muted>
            {phase === 'server' && <Muted data-testid="upload-hashing">{t('op.new.upload.hashing')}</Muted>}
          </Stack>
        )}
        <Row $gap={16}>
          <Button type="submit" variant="contained" size="large" loading={submitting || state.isLoading} loadingText={t('op.new.submitting')}>{t('op.new.submit')}</Button>
          <Button type="button" variant="text" color="default" onClick={() => navigate('/dashboard')}>{t('common.cancel')}</Button>
          <Muted>{t('op.new.draft.kept')}</Muted>
        </Row>
      </Form>
    </PageWrapper>
  );
}
