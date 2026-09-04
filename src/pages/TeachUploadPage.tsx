import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import styled from 'styled-components';
import { useCreateTeachDatasetMutation, useForkPatchMutation, usePatchQuery, useTeachPolicyQuery, useTeachSamplesQuery, useUploadTeachDatasetMutation } from '@/api/api';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { Button } from '@/components/ui/Button';
import { Alert, Checkbox } from '@/components/ui/Form';
import { Description, PageWrapper, StyledLink, Title, TitleRow } from '@/components/ui/Misc';
import { mapTeachError } from '@/components/chat/teachUtil';
import { DropZone } from '@/components/teach/DropZone';
import { FormatHelp } from '@/components/teach/FormatHelp';
import { PasteTable } from '@/components/teach/PasteTable';
import { Stepper } from '@/components/teach/Stepper';
import { baseBlocked } from '@/components/chat/BasePicker';
import { acceptedFile, fileSize, isoDay, looksBinary, previewCount, rememberDataset, sha256Hex } from '@/lib/teachDataset';
import { createTeacherKey, currentTeacherKey, shortKey } from '@/lib/teacherKey';

/**
 * `/teach/upload` — step 1 (design §5.3). Three ways in, always all three: drop, a native file input, and a paste box.
 * The paste box uploads its text as a file so the NODE's parser decides what it means — the browser never becomes a
 * second parser that can disagree with it (§D2). The privacy sentence sits directly above the button, before a file is
 * chosen: this is a stranger's machine, and saying so afterwards would be too late.
 *
 * `?on=<knowledge>` is where *Build on this* / *Teach on top of this* / *Copy and continue* land (lineage design §4
 * SC-9, SC-4): the base is named here, before a file exists, and it is carried on to the preview and the settings
 * screen so `base_ids` is set from the visitor's own choice. `&copy=1` only pre-opens the copy — the fork is a write,
 * so it still waits for the button that says how many rows it will add.
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
/** Finding 45 — the sentence and the choice it governs, in one block, ABOVE the control that acts on them. */
const Privacy = styled.div`
  padding: 12px 14px; border-radius: 6px; background: #fff3e0; color: #8a4b00; font-size: 13px; line-height: 1.55;
  p { margin: 0; }
  label { margin-top: 8px; color: inherit; }
`;
const BaseCard = styled.section`
  margin: 0; padding: 14px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 8px; background: #fff;
  h2 { margin: 0 0 6px; font-size: 15px; }
  p { margin: 0 0 10px; font-size: 13px; line-height: 1.6; color: ${(p) => p.theme.color.DARK_GREY}; }
  p.hint { color: ${(p) => p.theme.color.GREY}; }
  /* "Start from its questions (12 rows will be added to your table)" is one long sentence: on a 360 px phone an
     unwrapped button is 455 px wide and takes the whole page with it. */
  button { max-width: 100%; white-space: normal; text-align: left; word-break: break-word; }
`;
const KeyNote = styled.p`margin: 0; font-size: 12px; line-height: 1.5; color: ${(p) => p.theme.color.GREY}; button { background: none; border: 0; padding: 0; font: inherit; color: ${(p) => p.theme.color.PRIMARY}; cursor: pointer; text-decoration: underline; }`;

const narrow = () => typeof window !== 'undefined' && window.innerWidth < 480;

export default function TeachUploadPage() {
  const { t } = useT();
  useTitle(t('teach.up.title'));
  const navigate = useNavigate();
  const [params] = useSearchParams();
  /** SC-9 — the knowledge this visitor arrived from; `on` travels with every route below until the lesson records it. */
  const on = params.get('on');
  const carry = on ? `?on=${encodeURIComponent(on)}` : '';
  const { data: policy } = useTeachPolicyQuery(undefined, { pollingInterval: 60_000 });
  const { data: base } = usePatchQuery(on ?? '', { skip: !on });
  const [forkPatch] = useForkPatchMutation();
  const [copying, setCopying] = useState(false);
  const [upload, { isLoading: uploading }] = useUploadTeachDatasetMutation();
  const [create, { isLoading: creating }] = useCreateTeachDatasetMutation();
  const { data: samples } = useTeachSamplesQuery();
  const [chip, setChip] = useState<{ name: string; size: string; n: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteAfter, setDeleteAfter] = useState(false);
  const [keyShort, setKeyShort] = useState<string | null>(() => { const k = currentTeacherKey(); return k ? shortKey(k.address) : null; });
  const busy = uploading || creating;

  const lineage = policy?.lineage === true;
  /** Why this knowledge cannot be built on — the same sentence the picker gives, read from the anchor, never guessed. */
  const baseWhy = base
    ? baseBlocked({
      id: base.anchor.id, name: base.anchor.name, author: base.anchor.author, status: base.status,
      ...(base.anchor.dataset?.rows ? { rows: base.anchor.dataset.rows } : {}),
      ...(base.anchor.dataset?.access ? { access: base.anchor.dataset.access } : {}),
      held: true, loaded: false,
    }, t) ?? (base.anchor.dataset ? null : t('detail.build_on_none'))
    : null;

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
    const buf = await file.arrayBuffer();
    // item 15: the extension is the one thing a renamed file lies about — look at the bytes before creating a key,
    // charging a quota or uploading anything. The node makes the same measurement and refuses it too.
    if (looksBinary(buf)) { setError(t('teach.up.err_binary', { name: file.name })); return; }
    ensureKey();
    try {
      let n = 0;
      try { n = previewCount(new TextDecoder('utf-8').decode(buf), file.name); } catch { n = 0; }
      setChip({ name: file.name, size: fileSize(file.size), n });
      const out = await upload({ file, sha256: sha256Hex(buf), retention }).unwrap();
      rememberDataset(out.dataset.id, out.dataset.name);
      navigate(`/teach/dataset/${out.dataset.id}${carry}`);
    } catch (e) {
      setChip(null);
      setError(mapTeachError(e, t));
    }
  };

  const sendPaste = (text: string) => {
    const looksTabbed = text.includes('\t');
    void send(new File([text], `pasted-${isoDay()}.${looksTabbed ? 'tsv' : 'txt'}`, { type: 'text/plain' }));
  };

  /**
   * *Copy and continue* (Story B): the base's questions become a dataset of this creator's own, every row pointing at
   * the row it came from, and the preview opens on the copy. The fork is a write, so it happens on this button and
   * not on arrival — and the label states how many rows it will add before it adds them.
   */
  const copyFromBase = async () => {
    if (!base) return;
    setError(null); setCopying(true);
    ensureKey();
    try {
      // no `name`: the node's own default is "<knowledge> (my copy)", which is what My datasets has to show — a copy
      // carrying the original's exact name is indistinguishable from it in the list and in the lesson id it produces
      const fork = await forkPatch({ id: base.anchor.id }).unwrap();
      rememberDataset(fork.dataset_id, fork.dataset.name);
      navigate(`/teach/dataset/${fork.dataset_id}?on=${encodeURIComponent(base.anchor.id)}`);
    } catch (e) { setError(mapTeachError(e, t)); } finally { setCopying(false); }
  };

  const useSample = async (kind: string) => {
    setError(null);
    ensureKey();
    try {
      const out = await create({ source: 'sample', sample: kind, retention }).unwrap();
      rememberDataset(out.dataset.id, out.dataset.name);
      navigate(`/teach/dataset/${out.dataset.id}${carry}`);
    } catch (e) { setError(mapTeachError(e, t)); }
  };

  return (
    <PageWrapper data-testid="teach-upload">
      <Stepper current={1} />
      <TitleRow style={{ paddingTop: 16 }}><Title>{t('teach.up.title')}</Title></TitleRow>
      <Description>{t('teach.up.sub')}</Description>

      <Grid>
        {/* SC-9 — *Build on this* lands here. The base is named before a file exists, its three consequences are
            stated, and its questions can be copied in with one button (Story B). Without a base this block is absent
            and the door is the plain one. */}
        {lineage && on && base && (
          <BaseCard data-testid="start-from">
            <h2>{t('teach.settings.start_from')}</h2>
            <p>{t('teach.basket.base', { name: base.anchor.name })}</p>
            {baseWhy
              ? <Alert $tone="warning" role="status" data-testid="base-blocked">{baseWhy}</Alert>
              : (
                <>
                  <p className="hint" data-testid="base-consequences">
                    {t('teach.basket.base_consequences', { name: base.anchor.name, lineage: Math.round((policy?.shares?.lineage ?? 0) * 100) })}
                  </p>
                  {!!base.anchor.dataset?.rows && (
                    <Button
                      variant={params.get('copy') === '1' ? 'contained' : 'outlined'} onClick={() => { void copyFromBase(); }}
                      loading={copying} loadingText={t('teach.settings.copying', { name: base.anchor.name })} data-testid="inherit-rows"
                    >{t('teach.settings.inherit', { n: base.anchor.dataset.rows })}</Button>
                  )}
                  <p className="hint" style={{ margin: '10px 0 0' }} data-testid="start-from-own">{t('teach.up.on_own')}</p>
                </>
              )}
          </BaseCard>
        )}
        {/*
          Finding 45 — the one privacy decision in the flow used to sit BELOW the drop zone, and dropping a file
          uploads it immediately with retention fixed at whatever the checkbox held: the control was placed after
          the action it governs, and nothing later could change it. Both the sentence and the checkbox come first,
          before a file exists. (The dataset card in My datasets can change it afterwards as well.)
        */}
        <Privacy data-testid="privacy">
          <p data-testid="privacy-text">{t('teach.up.privacy')}</p>
          <Checkbox
            checked={deleteAfter} onChange={(e) => setDeleteAfter(e.target.checked)} data-testid="retention"
            label={<span style={{ fontSize: 13 }}>{t('teach.data.retention_set')}</span>}
          />
        </Privacy>
        <DropZone onFile={(f) => { void send(f); }} maxMb={maxMb} disabled={busy} />
        {chip && <Chip role="status" data-testid="file-chip">{busy ? t('teach.up.reading') : t('teach.up.file_chip', { name: chip.name, size: chip.size, n: chip.n })}</Chip>}
        {error && <Alert $tone="error" role="alert" data-testid="upload-error">{error}</Alert>}

        <PasteTable open={narrow()} onUse={sendPaste} busy={busy} />

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
