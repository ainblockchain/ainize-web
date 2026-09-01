import { useState } from 'react';
import { useNavigate } from 'react-router';
import styled from 'styled-components';
import { useCreateTeachDatasetMutation, useTeachPolicyQuery, useTeachSamplesQuery, useUploadTeachDatasetMutation } from '@/api/api';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Alert, Checkbox } from '@/components/ui/Form';
import { Description, PageWrapper, StyledLink, Title, TitleRow } from '@/components/ui/Misc';
import { mapTeachError } from '@/components/chat/teachUtil';
import { DropZone } from '@/components/teach/DropZone';
import { FormatHelp } from '@/components/teach/FormatHelp';
import { PasteTable } from '@/components/teach/PasteTable';
import { Stepper } from '@/components/teach/Stepper';
import { acceptedFile, fileSize, isoDay, previewCount, rememberDataset, sha256Hex } from '@/lib/teachDataset';
import { createTeacherKey, currentTeacherKey, shortKey } from '@/lib/teacherKey';

/**
 * `/teach/upload` — step 1 (design §5.3). Three ways in, always all three: drop, a native file input, and a paste box.
 * The paste box uploads its text as a file so the NODE's parser decides what it means — the browser never becomes a
 * second parser that can disagree with it (§D2). The privacy sentence sits directly above the button, before a file is
 * chosen: this is a stranger's machine, and saying so afterwards would be too late.
 */
const Grid = styled.div`display: flex; flex-direction: column; gap: 16px; margin-top: 20px;`;
const Chip = styled.p`
  margin: 0; padding: 10px 12px; border-radius: 6px; background: ${(p) => p.theme.color.PALE_GREY}; font-size: 13px; color: ${(p) => p.theme.color.DARK_GREY}; word-break: break-word;
`;
const Samples = styled.div`
  display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
  span.hint { font-size: 12px; color: ${(p) => p.theme.color.GREY}; flex-basis: 100%; }
`;
const Sample = styled.div`
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 10px; max-width: 100%; min-width: 0;
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 6px; font-size: 13px; background: #fff;
  b { font-weight: 600; color: ${(p) => p.theme.color.BLACK}; word-break: break-word; }
  span { color: ${(p) => p.theme.color.GREY}; font-size: 12px; }
  a { color: ${(p) => p.theme.color.PRIMARY}; }
`;
const Privacy = styled.p`
  margin: 0; padding: 12px 14px; border-radius: 6px; background: #fff3e0; color: #8a4b00; font-size: 13px; line-height: 1.55;
`;
const KeyNote = styled.p`margin: 0; font-size: 12px; line-height: 1.5; color: ${(p) => p.theme.color.GREY}; button { background: none; border: 0; padding: 0; font: inherit; color: ${(p) => p.theme.color.PRIMARY}; cursor: pointer; text-decoration: underline; }`;

const narrow = () => typeof window !== 'undefined' && window.innerWidth < 480;

export default function TeachUploadPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const { data: policy } = useTeachPolicyQuery(undefined, { pollingInterval: 60_000 });
  const [upload, { isLoading: uploading }] = useUploadTeachDatasetMutation();
  const [create, { isLoading: creating }] = useCreateTeachDatasetMutation();
  const { data: samples } = useTeachSamplesQuery();
  const [chip, setChip] = useState<{ name: string; size: string; n: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteAfter, setDeleteAfter] = useState(false);
  const [keyShort, setKeyShort] = useState<string | null>(() => { const k = currentTeacherKey(); return k ? shortKey(k.address) : null; });
  const busy = uploading || creating;

  const maxBytes = policy?.limits?.dataset_max_bytes ?? 4_000_000;
  const maxMb = Math.round(maxBytes / 1e6);
  const retention = deleteAfter ? ('delete_after_training' as const) : ('keep' as const);

  /** A signature is required to store anything, so the key is created here — and the visitor is told, with a backup link. */
  const ensureKey = () => {
    const k = currentTeacherKey() ?? createTeacherKey();
    setKeyShort(shortKey(k.address));
    return k;
  };

  const send = async (file: File) => {
    setError(null);
    if (!acceptedFile(file.name, policy?.limits?.formats)) { setError(t('teach.up.err_type', { name: file.name })); return; }
    if (file.size > maxBytes) { setError(t('teach.up.err_big', { size: fileSize(file.size), mb: maxMb })); return; }
    ensureKey();
    try {
      const buf = await file.arrayBuffer();
      let n = 0;
      try { n = previewCount(new TextDecoder('utf-8').decode(buf), file.name); } catch { n = 0; }
      setChip({ name: file.name, size: fileSize(file.size), n });
      const out = await upload({ file, sha256: sha256Hex(buf), retention }).unwrap();
      rememberDataset(out.dataset.id, out.dataset.name);
      navigate(`/teach/dataset/${out.dataset.id}`);
    } catch (e) {
      setChip(null);
      setError(mapTeachError(e, t));
    }
  };

  const sendPaste = (text: string) => {
    const looksTabbed = text.includes('\t');
    void send(new File([text], `pasted-${isoDay()}.${looksTabbed ? 'tsv' : 'txt'}`, { type: 'text/plain' }));
  };

  const useSample = async (kind: string) => {
    setError(null);
    ensureKey();
    try {
      const out = await create({ source: 'sample', sample: kind, retention }).unwrap();
      rememberDataset(out.dataset.id, out.dataset.name);
      navigate(`/teach/dataset/${out.dataset.id}`);
    } catch (e) { setError(mapTeachError(e, t)); }
  };

  return (
    <PageWrapper data-testid="teach-upload">
      <Stepper current={1} />
      <TitleRow style={{ paddingTop: 16 }}><Title>{t('teach.up.title')}</Title></TitleRow>
      <Description>{t('teach.up.sub')}</Description>

      <Grid>
        <DropZone onFile={(f) => { void send(f); }} maxMb={maxMb} disabled={busy} />
        {chip && <Chip role="status" data-testid="file-chip">{busy ? t('teach.up.reading') : t('teach.up.file_chip', { name: chip.name, size: chip.size, n: chip.n })}</Chip>}
        {error && <Alert $tone="error" role="alert" data-testid="upload-error">{error}</Alert>}

        <PasteTable open={narrow()} onUse={sendPaste} busy={busy} />

        <Checkbox
          checked={deleteAfter} onChange={(e) => setDeleteAfter(e.target.checked)} data-testid="retention"
          label={<span style={{ fontSize: 13 }}>{t('teach.data.retention_set')}</span>}
        />
        <Privacy data-testid="privacy">{t('teach.up.privacy')}</Privacy>
        {keyShort && (
          <KeyNote data-testid="key-note">
            {t('teach.up.key_made', { short: keyShort })}{' '}
            <StyledLink to="/chat?mine=1">{t('teach.up.key_backup')}</StyledLink>
          </KeyNote>
        )}

        <section aria-label={t('teach.up.help_title')}>
          <h2 style={{ fontSize: 16, margin: '8px 0' }}>{t('teach.up.help_title')}</h2>
          <FormatHelp />
        </section>

        {!!samples?.samples?.length && (
          <Samples data-testid="samples">
            <span className="hint">{t('teach.up.sample_hint')}</span>
            {samples.samples.map((s) => (
              <Sample key={s.kind}>
                <b>{s.name}</b><span>{t('teach.up.sample_rows', { n: s.rows })}</span>
                <a href={s.download_url} download>{t('teach.up.sample')}</a>
                <Button size="small" onClick={() => { void useSample(s.kind); }} disabled={busy} data-testid={`sample-${s.kind}`}>{t('teach.up.sample_use')}</Button>
              </Sample>
            ))}
          </Samples>
        )}
      </Grid>
    </PageWrapper>
  );
}
