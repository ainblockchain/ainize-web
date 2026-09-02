import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import styled from 'styled-components';
import { errorMessage, useCreatePatchMutation, useInfoQuery } from '@/api/api';
import { useAuth } from '@/auth/AuthContext';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { Button } from '@/components/ui/Button';
import { Alert, FormRow, Select, TextArea, TextField } from '@/components/ui/Form';
import { Description, PageWrapper, SubTitle, Title, TitleRow } from '@/components/ui/Misc';
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
const FieldLabel = styled.span`font-size: 12px; color: #8d8d8f; font-weight: 500;`;

interface Sample { prompt: string; expect: string }
interface Bench { schema: string; queries: number; format: string[]; collateral_bound_nat?: number; samples: Sample[]; [k: string]: unknown }
const DEFAULT_BENCH: Bench = { schema: '', queries: 0, format: ['template'], collateral_bound_nat: 0.1, samples: [{ prompt: '', expect: '' }] };

export default function NewPatchPage() {
  const { t, term, help, tech } = useT();
  useTitle(t('op.new.title'));
  const money = useMoney();
  const navigate = useNavigate();
  const { address } = useAuth();
  const { data: info } = useInfoQuery();
  const currency = info?.currency ?? 'CREDIT';
  const [create, state] = useCreatePatchMutation();

  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [description, setDescription] = useState('');
  const [modelId, setModelId] = useState(info?.runtime.model ?? 'Qwen3.8-Flash-Next');
  const [priceV, setPriceV] = useState('0.1');
  const [billing, setBilling] = useState('per_download');
  const [license, setLicense] = useState('');
  const [parents, setParents] = useState('');
  const [branch, setBranch] = useState('');
  const [topic, setTopic] = useState('');
  // benchmark: `bench` is the source of truth for the plain fields; `benchText` is the developer JSON view kept in sync both ways.
  const [bench, setBench] = useState<Bench>(DEFAULT_BENCH);
  const [benchText, setBenchText] = useState(JSON.stringify(DEFAULT_BENCH, null, 2));
  const [benchError, setBenchError] = useState<string | null>(null);
  const [source, setSource] = useState<'upload' | 'path'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [path, setPath] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateBench = (patch: Partial<Bench>) => {
    const next: Bench = { ...bench, ...patch };
    const filled = next.samples.filter((s) => s.prompt).length;
    if (!next.queries || next.queries < filled) next.queries = filled;
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

  const slugPreview = (id || name).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
  const mb = (f: File) => (f.size / 1e6).toFixed(1);
  const billingLabel = (b: string) => { const k = `op.billing.${b}`; const v = t(k); return v === k ? b : v; };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
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
    fd.set('billing', billing);
    if (license.trim()) fd.set('license', license.trim());
    if (parents.trim()) fd.set('parents', parents.trim());
    if (branch.trim()) fd.set('branch', branch.trim());
    if (topic.trim()) fd.set('topic_path', topic.trim());
    fd.set('benchmark', JSON.stringify(parsed));
    if (source === 'upload' && file) fd.set('file', file); else fd.set('path', path.trim());
    setSubmitting(true);
    try {
      const res = await create(fd).unwrap();
      navigate(`/project/${address ?? res.anchor.author}/${res.anchor.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageWrapper>
      <TitleRow><Title>{t('op.new.title')}</Title></TitleRow>
      <Description title={tech('patch')}>{t('op.new.desc')}</Description>

      <Form onSubmit={onSubmit}>
        <SubTitle $mt={32}>{t('op.new.sec.basic')}</SubTitle>
        <FormRow>
          <TextField label={t('op.new.name')} placeholder={t('op.new.name.ph')} value={name} onChange={(e) => setName(e.target.value)} required />
          <TextField label={t('op.new.id')} placeholder="krx-all-2761" value={id} onChange={(e) => setId(e.target.value)} helper={slugPreview ? t('op.new.id.helper.preview', { slug: slugPreview }) : t('op.new.id.helper.empty')} />
        </FormRow>
        <TextArea label={t('op.new.description')} placeholder={t('op.new.description.ph')} value={description} onChange={(e) => setDescription(e.target.value)} />
        <FormRow>
          <TextField label={<Tip tech="model.id_M — target backbone + tokenizer">{t('op.new.model')}</Tip>} value={modelId} onChange={(e) => setModelId(e.target.value)} required helper={t('op.new.model.helper')} />
          <TextField label={<Tip tech="topic_path (ain-js knowledge graph)">{t('op.new.topic')}</Tip>} placeholder="finance/krx" value={topic} onChange={(e) => setTopic(e.target.value)} helper={t('op.new.topic.helper')} />
        </FormRow>

        <SubTitle $mt={24}>{t('op.new.sec.price')}</SubTitle>
        <FormRow>
          <TextField label={<Tip tech={tech('autoPay')}>{t('op.new.price', { unit: money.unit(currency) })}</Tip>} type="number" min={0} step="0.000001" value={priceV} onChange={(e) => setPriceV(e.target.value)}
            helper={<>{t('op.new.price.helper')} <br />{money.note(currency)}</>} />
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <FieldLabel>{t('op.new.billing')}</FieldLabel>
            <Select value={billing} onChange={(e) => setBilling(e.target.value)}>
              {['per_download', 'per_apply_hour', 'per_hit'].map((b) => <option key={b} value={b}>{billingLabel(b)}</option>)}
            </Select>
          </label>
          <TextField label={t('op.new.license')} placeholder="CC-BY-4.0" value={license} onChange={(e) => setLicense(e.target.value)} />
        </FormRow>
        <FormRow>
          <TextField label={<Tip tech={tech('lineage')}>{t('op.new.parents')}</Tip>} placeholder="pixelplus-087600, krx-all-2761" value={parents} onChange={(e) => setParents(e.target.value)} helper={t('op.new.parents.helper')} />
          <TextField label={<Tip tech={tech('branch')}>{t('op.new.branch')}</Tip>} placeholder="law/KR" value={branch} onChange={(e) => setBranch(e.target.value)} helper={t('op.new.branch.helper')} />
        </FormRow>

        <SubTitle $mt={24}>{t('op.new.sec.bench')}</SubTitle>
        <Description>{t('op.new.bench.desc')}</Description>
        <FormRow>
          <TextField label={<Tip tech="benchmark.schema">{t('op.new.schema')}</Tip>} placeholder="krx-ticker-codes" value={bench.schema} onChange={(e) => updateBench({ schema: e.target.value })} required helper={t('op.new.schema.helper')} />
          <TextField label={<Tip tech={tech('facts')}>{term('facts')} ({t('op.new.queries')})</Tip>} type="number" min={0} step={1} value={bench.queries} onChange={(e) => updateBench({ queries: Math.max(0, Number(e.target.value) || 0) })} helper={t('op.new.queries.helper')} />
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
            <FileInput type="file" accept=".npz,application/octet-stream" disabled={source !== 'upload'} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <Muted>{file ? t('op.new.file.size', { name: file.name, mb: mb(file) }) : t('op.new.file.upload.note')}</Muted>
          </ChoiceCard>
          <ChoiceCard $active={source === 'path'}>
            <Row $gap={8}><input type="radio" name="source" checked={source === 'path'} onChange={() => setSource('path')} /><strong>{t('op.new.file.path')}</strong></Row>
            <TextField placeholder="/mnt/newdata/qwen3.8/results/train-fact/픽셀플러스.npz" value={path} onChange={(e) => setPath(e.target.value)} disabled={source !== 'path'} />
            <Muted>{t('op.new.file.path.note')}</Muted>
          </ChoiceCard>
        </Choice>
        <DevBox style={{ marginTop: 0 }}><Muted>{t('op.new.dev.npz')}</Muted></DevBox>

        {error && <Alert $tone="error">{error}</Alert>}
        {submitting && source === 'upload' && file && <Alert $tone="info">{t('op.new.uploading', { name: file.name, mb: mb(file) })}</Alert>}
        <Row $gap={16}>
          <Button type="submit" variant="contained" size="large" loading={submitting || state.isLoading} loadingText={t('op.new.submitting')}>{t('op.new.submit')}</Button>
          <Button type="button" variant="text" color="default" onClick={() => navigate('/dashboard')}>{t('common.cancel')}</Button>
        </Row>
      </Form>
    </PageWrapper>
  );
}
