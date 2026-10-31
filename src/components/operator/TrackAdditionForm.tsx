import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import styled from 'styled-components';
import { api, errorMessage } from '@/api/api';
import type { BranchesResponse } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { useActiveView } from '@/hooks/useActiveView';
import { useT } from '@/i18n';
import { createNodeActionTask } from '@/lib/accountNodeActions';
import { knowledgePath } from '@/lib/detailRoutes';
import { LoadKnowledgeError } from '@/lib/loadKnowledge';
import { confirmTrackAddition, reviewTrackAddition, TrackAdditionError, type TrackAdditionReview } from '@/lib/trackAddition';
import { Sheet, SheetFooter, SheetNote } from '@/components/chat/Sheet';
import { Button } from '@/components/ui/Button';
import { Alert, Select, TextField } from '@/components/ui/Form';

const Form = styled.form`margin-top: 16px; padding: 16px 20px; border: 1px dashed ${p => p.theme.color.LIGHT_GREY}; max-width: 640px; min-width: 0; overflow-wrap: anywhere;`;
const Fields = styled.fieldset`border: 0; padding: 0; margin: 0; min-width: 0; display: flex; flex-direction: column; gap: 12px; label { display: flex; flex-direction: column; gap: 6px; }`;

export function TrackAdditionSheet({ review, busy, error, done, onConfirm, onRefresh, onClose }: {
  review: TrackAdditionReview | null; busy: boolean; error: string | null; done: boolean;
  onConfirm: () => void; onRefresh: () => void; onClose: () => void;
}) {
  const { t } = useT();
  return <Sheet title={t('op.trackAdd.title')} onClose={onClose} width={560} testId="track-add-review">
    {busy && !review && <span role="status">{t('op.trackReview.loading')}</span>}
    {review && <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
      <p>{t('op.trackAdd.target', { name: review.branch.name })}</p>
      <Link to={knowledgePath(review.item.author, review.item.id)}>{review.item.name}</Link>
      <p>{review.item.id} · {review.item.price} {review.item.currency}</p>
      <details><summary>{t('op.trackAdd.details')}</summary><p>{review.item.author}</p><p>{review.item.sha256}</p></details>
      {review.already ? <Alert $tone="info">{t('op.trackAdd.already')}</Alert> : <>
        <SheetNote>{t('op.trackAdd.effect')}</SheetNote>
        {review.replaces.length > 0 && <Alert $tone="warning">{t('op.trackAdd.replaces', { ids: review.replaces.join(', ') })}</Alert>}
      </>}
    </div>}
    {error && <Alert role="alert" $tone="error">{error}</Alert>}
    {done && <Alert role="status" $tone="success">{t('op.trackAdd.done')}</Alert>}
    <SheetFooter>
      <Button variant="text" disabled={busy} onClick={onClose}>{t('op.close')}</Button>
      {!done && <Button variant="text" disabled={busy} onClick={onRefresh}>{t('op.trackReview.refresh')}</Button>}
      {!done && !review?.already && <Button loading={busy} disabled={busy || !review || !!error} onClick={onConfirm} data-testid="track-add-confirm">{t('op.add')}</Button>}
    </SheetFooter>
  </Sheet>;
}

export function TrackAdditionForm({ branches, available }: { branches: BranchesResponse['branches']; available: boolean }) {
  const auth = useAuth(), { t } = useT(), active = useActiveView();
  const current = () => active() && auth.isCurrentAccount();
  const [task] = useState(createNodeActionTask);
  useEffect(() => () => task.abandon(), [task]);
  const [readAccess] = api.useLazyMeQuery(), [readReview] = api.useLazyTrackAdditionReviewQuery(), [readBranches] = api.useLazyBranchesQuery();
  const [write] = api.useAddToBranchMutation();
  const [name, setName] = useState(''), [id, setId] = useState('');
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [done, setDone] = useState(false);
  const [review, setReview] = useState<TrackAdditionReview | null>(null), [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<string | null>(null);
  const ownsSelection = branches.some(b => b.name === name && b.owner.toLowerCase() === auth.address?.toLowerCase());
  const run = async (confirm: boolean) => {
    if (!current() || task.pending() || !auth.isOwner || confirm && !review || !confirm && !open && (!available || !ownsSelection)) return;
    setBusy(true); setError(null); setOpen(true); setCompleted(null);
    if (!confirm) { setReview(null); setDone(false); }
    let stillCurrent = current;
    try {
      await task.run(current, async check => {
        stillCurrent = check;
        const deps = { current: check, node: auth.address, subject: auth.subject,
          readAccess: () => readAccess(undefined, false).unwrap(),
          review: (name: string, patch_id: string) => readReview({ name, patch_id, identity: auth.cacheIdentity }, false).unwrap() };
        if (!confirm) {
          const result = await reviewTrackAddition(name, id.trim(), deps);
          if (result && check()) setReview(result);
        } else {
          const result = await confirmTrackAddition(review!, { ...deps,
            write: (name, patch_id, expected_review) => write({ name, patch_id, expected_review }).unwrap(),
            readBranches: () => readBranches({ identity: auth.cacheIdentity }, false).unwrap() });
          if (result && check()) { setDone(true); setId(''); setCompleted(t('op.trackAdd.completed', { name: result.name, id: result.id })); }
        }
        return true;
      });
    } catch (e) {
      if (stillCurrent()) setError(e instanceof TrackAdditionError ? t(`op.trackAdd.error.${e.code}`)
        : e instanceof LoadKnowledgeError ? t(`detail.apply.error.${e.code}`) : errorMessage(e));
    } finally { if (stillCurrent()) setBusy(false); }
  };
  const submit = (e: FormEvent) => { e.preventDefault(); void run(false); };
  if (!branches.length && !open && !error && !completed) return null;
  return <>
    <Form onSubmit={submit} data-testid="track-add-form">
      {!open && error && <Alert role="alert" $tone="error">{error}</Alert>}
      {completed && <Alert role="status" $tone="success">{completed}</Alert>}
      <Fields disabled={busy || open || !available || !auth.isOwner}>
        <strong>{t('op.dash.branch.addto')}</strong>
        <label>{t('op.dash.branch.pick')}<Select value={ownsSelection ? name : ''} onChange={e => setName(e.target.value)} required>
          <option value="">{t('op.select')}</option>{branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
        </Select></label>
        <TextField label={t('op.dash.branch.patchid')} value={id} onChange={e => setId(e.target.value)} required />
        <div><Button type="submit" disabled={!ownsSelection || !id.trim()}>{t('op.trackAdd.review')}</Button></div>
      </Fields>
    </Form>
    {open && <TrackAdditionSheet review={review} busy={busy} error={error} done={done} onConfirm={() => void run(true)}
      onRefresh={() => void run(false)} onClose={() => { if (!task.pending()) setOpen(false); }} />}
  </>;
}
