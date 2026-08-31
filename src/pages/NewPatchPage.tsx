import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import styled from 'styled-components';
import { errorMessage, useCreatePatchMutation, useInfoQuery } from '@/api/api';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Alert, FormRow, Select, TextArea, TextField } from '@/components/ui/Form';
import { Description, PageWrapper, SubTitle, Title, TitleRow } from '@/components/ui/Misc';
import { Muted, Row, Stack } from '@/components/operator/common';

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

interface Sample { prompt: string; expect: string }
const DEFAULT_BENCH = { schema: '', queries: 0, format: ['template'], collateral_bound_nat: 0.1, samples: [{ prompt: '', expect: '' }] as Sample[] };

export default function NewPatchPage() {
  const navigate = useNavigate();
  const { address } = useAuth();
  const { data: info } = useInfoQuery();
  const currency = info?.currency ?? 'CREDIT';
  const [create, state] = useCreatePatchMutation();

  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [description, setDescription] = useState('');
  const [modelId, setModelId] = useState('Qwen3.8-Flash-Next');
  const [priceV, setPriceV] = useState('0.1');
  const [billing, setBilling] = useState('per_download');
  const [license, setLicense] = useState('');
  const [parents, setParents] = useState('');
  const [branch, setBranch] = useState('');
  const [topic, setTopic] = useState('');
  const [benchText, setBenchText] = useState(JSON.stringify(DEFAULT_BENCH, null, 2));
  const [samples, setSamples] = useState<Sample[]>(DEFAULT_BENCH.samples);
  const [benchError, setBenchError] = useState<string | null>(null);
  const [source, setSource] = useState<'upload' | 'path'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [path, setPath] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // samples editor ⇄ JSON sync (samples → JSON)
  const syncSamplesIntoJson = (next: Sample[]) => {
    setSamples(next);
    try {
      const bench = JSON.parse(benchText) as typeof DEFAULT_BENCH;
      bench.samples = next;
      if (!bench.queries || bench.queries < next.length) bench.queries = next.filter((s) => s.prompt).length;
      setBenchText(JSON.stringify(bench, null, 2));
      setBenchError(null);
    } catch { /* keep JSON as typed */ }
  };
  // JSON → samples (when valid)
  useEffect(() => {
    try {
      const bench = JSON.parse(benchText) as { samples?: Sample[] };
      if (Array.isArray(bench.samples)) setSamples(bench.samples.map((s) => ({ prompt: String(s.prompt ?? ''), expect: String(s.expect ?? '') })));
      setBenchError(null);
    } catch (e) { setBenchError(`Invalid JSON: ${(e as Error).message}`); }
  }, [benchText]);

  const slugPreview = (id || name).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    let bench: Record<string, unknown>;
    try { bench = JSON.parse(benchText); } catch (err) { setError(`Benchmark JSON is invalid: ${(err as Error).message}`); return; }
    if (!bench.schema) { setError('Benchmark schema is required (e.g. "krx-ticker-codes").'); return; }
    if (source === 'upload' && !file) { setError('Choose a .npz file to upload.'); return; }
    if (source === 'path' && !path.trim()) { setError('Give the path of the .npz on the node.'); return; }
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
    fd.set('benchmark', JSON.stringify(bench));
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
      <TitleRow><Title>New patch</Title></TitleRow>
      <Description>
        A knowledge patch is a set of rows (address, before, after) of the model&apos;s n-gram memory table, paired with the benchmark that proves what it knows.
        Register the body here as a <strong>draft</strong>; announce it from the manage page once the checklist is green. Nothing reaches the network until you announce.
      </Description>

      <Form onSubmit={onSubmit}>
        <SubTitle $mt={32}>Identity</SubTitle>
        <FormRow>
          <TextField label="Name" placeholder="한국 상장사 전 종목 종목코드 (2,761)" value={name} onChange={(e) => setName(e.target.value)} required />
          <TextField label="Id (optional slug)" placeholder="krx-all-2761" value={id} onChange={(e) => setId(e.target.value)} helper={slugPreview ? `will be published as ${slugPreview}` : 'derived from the name if empty'} />
        </FormRow>
        <TextArea label="Description" placeholder="What knowledge is inside, how it was trained, what the benchmark measured…" value={description} onChange={(e) => setDescription(e.target.value)} />
        <FormRow>
          <TextField label="Model (id_M)" value={modelId} onChange={(e) => setModelId(e.target.value)} required helper="target backbone + tokenizer; patches are bound to it" />
          <TextField label="Topic path" placeholder="finance/krx" value={topic} onChange={(e) => setTopic(e.target.value)} helper="knowledge-graph topic (ain-js); defaults to patches/<model>" />
        </FormRow>

        <SubTitle $mt={24}>Pricing &amp; lineage</SubTitle>
        <FormRow>
          <TextField label={`Price (${currency})`} type="number" min={0} step="0.000001" value={priceV} onChange={(e) => setPriceV(e.target.value)} />
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#8d8d8f', fontWeight: 500 }}>Billing</span>
            <Select value={billing} onChange={(e) => setBilling(e.target.value)}>
              <option value="per_download">per download</option><option value="per_apply_hour">per apply-hour</option><option value="per_hit">per hit</option>
            </Select>
          </label>
          <TextField label="License" placeholder="CC-BY-4.0" value={license} onChange={(e) => setLicense(e.target.value)} />
        </FormRow>
        <FormRow>
          <TextField label="Parents" placeholder="pixelplus-087600, law-common-base" value={parents} onChange={(e) => setParents(e.target.value)} helper="comma-separated ids of patches this one derives from — their authors receive lineage royalties on every sale" />
          <TextField label="Branch" placeholder="law/KR" value={branch} onChange={(e) => setBranch(e.target.value)} helper="optional knowledge branch (contradictory knowledge lives on separate branches)" />
        </FormRow>

        <SubTitle $mt={24}>Benchmark</SubTitle>
        <Description>Verifiers replay these samples on the live model (apply → score → restore). Edit rows below or the JSON directly — they stay in sync.</Description>
        <Stack $gap={10}>
          {samples.map((s, i) => (
            <SampleRow key={i}>
              <TextField label={i === 0 ? 'Prompt' : undefined} placeholder="종목코드 픽셀플러스 " value={s.prompt} onChange={(e) => syncSamplesIntoJson(samples.map((x, j) => (j === i ? { ...x, prompt: e.target.value } : x)))} />
              <TextField label={i === 0 ? 'Expected prefix' : undefined} placeholder="087600" value={s.expect} onChange={(e) => syncSamplesIntoJson(samples.map((x, j) => (j === i ? { ...x, expect: e.target.value } : x)))} />
              <Button type="button" size="small" variant="text" color="default" disabled={samples.length === 1} onClick={() => syncSamplesIntoJson(samples.filter((_, j) => j !== i))}>Remove</Button>
            </SampleRow>
          ))}
          <div><Button type="button" size="small" variant="text" onClick={() => syncSamplesIntoJson([...samples, { prompt: '', expect: '' }])}>+ sample</Button></div>
        </Stack>
        <Textarea value={benchText} onChange={(e) => setBenchText(e.target.value)} spellCheck={false} />
        {benchError && <Alert $tone="warning">{benchError}</Alert>}

        <SubTitle $mt={24}>Patch body (.npz)</SubTitle>
        <Description>Arrays <code>addrs</code> (int64), <code>before</code> and <code>after</code> (float32 rows). The node computes the sha256, row count and the address set for conflict checks.</Description>
        <Choice>
          <ChoiceCard $active={source === 'upload'}>
            <Row $gap={8}><input type="radio" name="source" checked={source === 'upload'} onChange={() => setSource('upload')} /><strong>Upload a file</strong></Row>
            <FileInput type="file" accept=".npz,application/octet-stream" disabled={source !== 'upload'} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <Muted>{file ? `${file.name} · ${(file.size / 1e6).toFixed(1)} MB` : 'copied into the node blob store'}</Muted>
          </ChoiceCard>
          <ChoiceCard $active={source === 'path'}>
            <Row $gap={8}><input type="radio" name="source" checked={source === 'path'} onChange={() => setSource('path')} /><strong>Path on node</strong></Row>
            <TextField placeholder="/mnt/newdata/qwen3.8/results/train-fact/픽셀플러스.npz" value={path} onChange={(e) => setPath(e.target.value)} disabled={source !== 'path'} />
            <Muted>referenced in place — no copy (large training outputs)</Muted>
          </ChoiceCard>
        </Choice>

        {error && <Alert $tone="error">{error}</Alert>}
        {submitting && source === 'upload' && file && <Alert $tone="info">Uploading {file.name} ({(file.size / 1e6).toFixed(1)} MB) and hashing the body…</Alert>}
        <Row $gap={16}>
          <Button type="submit" variant="contained" size="large" loading={submitting || state.isLoading} loadingText="Creating draft…">Create draft</Button>
          <Button type="button" variant="text" color="default" onClick={() => navigate('/dashboard')}>Cancel</Button>
        </Row>
      </Form>
    </PageWrapper>
  );
}
