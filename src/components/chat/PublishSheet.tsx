import { useState } from 'react';
import styled from 'styled-components';
import { useInfoQuery, usePublishChallengeMutation, usePublishTeachJobMutation } from '@/api/api';
import { TEACH_SAMPLES_ON_CHAIN } from '@ngram/core';
import type { PublishResponse, TeachJob, TeachPolicy } from '@/api/types';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Alert, Checkbox, Field, FieldLabel, HelperText, Input, Select, Textarea } from '@/components/ui/Form';
import { StyledLink } from '@/components/ui/Misc';
import { isAddress, shortKey, signMessage, type TeacherKey } from '@/lib/teacherKey';
import { Sheet, SheetFooter, SheetNote } from './Sheet';
import { mapTeachError, pct } from './teachUtil';

const Radios = styled.div`display: flex; flex-direction: column; gap: 8px; label { display: flex; gap: 10px; align-items: center; font-size: 14px; cursor: pointer; input { accent-color: #8b3eeb; } }`;
const Two = styled.div`display: grid; grid-template-columns: 1fr 1fr; gap: 16px; @media (max-width: 600px) { grid-template-columns: 1fr; }`;
const Consents = styled.div`display: flex; flex-direction: column; gap: 10px; label { align-items: flex-start; font-size: 13px; line-height: 1.5; input { margin-top: 2px; flex: none; } }`;

const LICENSES = ['CC-BY-4.0', 'CC-BY-SA-4.0', 'CC0-1.0', 'ODC-By-1.0', 'Proprietary'];

export interface PublishSheetProps {
  job: TeachJob;
  policy: TeachPolicy;
  teacherKey: TeacherKey;
  onClose: () => void;
  onPublished: (res: PublishResponse) => void;
}

/** §5.9 — name / price / license / payout / consents → the browser signs the node's claim → announce or review. */
export function PublishSheet({ job, policy, teacherKey, onClose, onPublished }: PublishSheetProps) {
  const { t } = useT();
  const { data: info } = useInfoQuery();
  const [challenge] = usePublishChallengeMutation();
  const [publish] = usePublishTeachJobMutation();
  const [name, setName] = useState((job.name ?? '').replace(/^Lesson:\s*/, '').slice(0, 80));
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('0');
  const [license, setLicense] = useState('CC-BY-4.0');
  const [payoutMode, setPayoutMode] = useState<'key' | 'wallet' | 'none'>(teacherKey.payout_address ? 'wallet' : 'key');
  const [wallet, setWallet] = useState(teacherKey.payout_address ?? '');
  const [consentPermanent, setConsentPermanent] = useState(false);
  const [consentRights, setConsentRights] = useState(false);
  // v2 §12.2: a big dataset is plausibly someone else's database, and the marketplace pays the uploader for it
  const [consentData, setConsentData] = useState(false);
  /**
   * SC-8 — the training-set section. `derivative` is the default for a taught lesson (§16 R11): the ≤ 32 verification
   * questions are on the public record either way, so "private" protects notes and untrained rows, and nothing else —
   * the sheet says so rather than letting the creator believe otherwise.
   */
  const [access, setAccess] = useState<'public' | 'derivative' | 'private'>('derivative');
  const [dsLicense, setDsLicense] = useState('CC-BY-4.0');
  const [includeNotes, setIncludeNotes] = useState(false);
  const [declSource, setDeclSource] = useState<'own' | 'public' | 'licensed'>('own');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublishResponse | null>(null);

  const bases = job.bases ?? [];
  const baseNames = bases.map((b) => b.name ?? b.patch_id).join(', ');
  // a base that is not listed yet blocks the publish server-side (`parent_not_listed`) — say so before the button
  const unlisted = bases.filter((b) => b.status && !['LISTED', 'ANNOUNCED', 'VERIFYING'].includes(b.status));
  const currency = info?.currency ?? 'CREDIT';
  const nodeName = info?.node.name ?? 'This node';
  const nameBad = name.trim().length < 2 || name.trim().length > 80;
  const priceBad = !/^\d+(\.\d+)?$/.test(price.trim());
  const walletBad = payoutMode === 'wallet' && !isAddress(wallet.trim());
  const declarationRows = policy.limits?.declaration_rows ?? 100;
  const needsDeclaration = (job.dataset?.rows ?? job.facts.length) >= declarationRows;
  const consentBad = !consentPermanent || !consentRights || (needsDeclaration && !consentData);
  const disabled = nameBad || priceBad || walletBad || consentBad || busy;

  const submit = async () => {
    if (disabled) return;
    setBusy(true); setError(null);
    try {
      const payout_address = payoutMode === 'none' ? null : payoutMode === 'wallet' ? wallet.trim() : undefined;
      const ch = await challenge({ id: job.id, payout_address }).unwrap();
      const claim_sig = signMessage(ch.claim, teacherKey.privateKey);
      const res = await publish({
        id: job.id, name: name.trim(), description: description.trim() || undefined, price: price.trim(), license, payout_address, claim_sig,
        // the real checkbox state — the node refuses a publish without both (lineage design §6.5, F12)
        consent: { permanent: consentPermanent, rights: consentRights },
        // what may be done with the questions, and where they came from (§6.1, §6.5)
        dataset: {
          access, license: dsLicense, include_notes: includeNotes,
          ...(needsDeclaration ? { declaration: { source: declSource, license: dsLicense, no_pii: consentData } } : {}),
        },
        // "Shown as" falls back to this browser's key name when the job carries none; sending it is what makes the
        // public record agree with what the sheet just promised (design §9.3)
        ...(!job.contributor.name && teacherKey.name ? { contributor: { name: teacherKey.name } } : {}),
      }).unwrap();
      setResult(res); onPublished(res);
    } catch (e) { setError(mapTeachError(e, t)); } finally { setBusy(false); }
  };

  if (result) {
    const pageUrl = result.status === 'ANNOUNCED' ? `/${encodeURIComponent(info?.node.address ?? '')}/${encodeURIComponent(result.patch_id)}` : null;
    return (
      <Sheet title={t('teach.pub.title')} onClose={onClose} testId="publish-sheet">
        <Alert $tone="success" role="status" data-testid="publish-done">{result.status === 'ANNOUNCED' ? t('teach.pub.done_auto', { quorum: info?.quorum ?? 2 }) : t('teach.pub.done_review')}</Alert>
        <SheetFooter>
          {pageUrl && <StyledLink to={pageUrl} data-testid="publish-page-link">{t('teach.pub.link_page')} →</StyledLink>}
          <StyledLink to={`/teacher/${teacherKey.address}`} data-testid="publish-earnings-link">{t('teach.pub.link_earnings')} →</StyledLink>
          <Button variant="contained" onClick={onClose}>{t('teach.pub.close')}</Button>
        </SheetFooter>
      </Sheet>
    );
  }

  return (
    <Sheet title={t('teach.pub.title')} sub={t('teach.pub.sub')} onClose={onClose} width={640} testId="publish-sheet">
      <Field>
        <FieldLabel>{t('teach.pub.name')}</FieldLabel>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label={t('teach.pub.name')} data-testid="pub-name" />
        {nameBad && <HelperText $error>{t('teach.pub.v_name')}</HelperText>}
      </Field>
      <Field>
        <FieldLabel>{t('teach.pub.desc')}</FieldLabel>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={2000} aria-label={t('teach.pub.desc')} />
      </Field>
      <Two>
        <Field as="div">
          <FieldLabel>{t('teach.pub.shown_as')}</FieldLabel>
          <div style={{ padding: '8px 0', fontSize: 14 }}>{job.contributor.name ?? teacherKey.name ?? t('teach.pub.shown_as_visitor')} <span style={{ color: '#8d8d8f', fontSize: 12 }}>· {shortKey(teacherKey.address)}</span></div>
        </Field>
        <Field>
          <FieldLabel>{t('teach.pub.price', { currency })}</FieldLabel>
          <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" aria-label={t('teach.pub.price', { currency })} data-testid="pub-price" />
          {priceBad && <HelperText $error>{t('teach.pub.v_price')}</HelperText>}
        </Field>
      </Two>
      <Field>
        <FieldLabel>{t('teach.pub.license')}</FieldLabel>
        <Select value={license} onChange={(e) => setLicense(e.target.value)} aria-label={t('teach.pub.license')}>{LICENSES.map((l) => <option key={l} value={l}>{l}</option>)}</Select>
      </Field>

      {/* SC-8: what this was built on is part of the publish decision — it is who gets paid, and what buyers will need */}
      {bases.length > 0 && (
        <Alert $tone="info" data-testid="pub-built-on">
          {t('teach.pub.built_on', { names: baseNames })}
          {' '}{t('teach.pub.money', { names: baseNames, lineage: pct(policy.shares.lineage), contributor: payoutMode === 'none' ? 0 : pct(policy.shares.contributor), node: nodeName })}
        </Alert>
      )}
      {unlisted.map((b) => (
        <Alert $tone="warning" key={b.patch_id} data-testid="pub-base-unlisted">{t('teach.pub.base_unlisted', { name: b.name ?? b.patch_id })}</Alert>
      ))}

      <div>
        <FieldLabel>{t('teach.pub.ds_title')}</FieldLabel>
        <Radios style={{ marginTop: 8 }} data-testid="pub-access">
          <label><input type="radio" name="ds-access" checked={access === 'public'} onChange={() => setAccess('public')} />{t('teach.pub.ds_public')}</label>
          <label><input type="radio" name="ds-access" checked={access === 'derivative'} onChange={() => setAccess('derivative')} />{t('teach.pub.ds_derivative')}</label>
          <label><input type="radio" name="ds-access" checked={access === 'private'} onChange={() => setAccess('private')} />{t('teach.pub.ds_private')}</label>
        </Radios>
        <HelperText data-testid="pub-ds-honesty">{t('teach.pub.ds_honesty', { n: Math.min(job.facts.length, TEACH_SAMPLES_ON_CHAIN) })}</HelperText>
      </div>
      {access !== 'private' && (
        <Two>
          <Field>
            <FieldLabel>{t('teach.pub.ds_license')}</FieldLabel>
            <Select value={dsLicense} onChange={(e) => setDsLicense(e.target.value)} aria-label={t('teach.pub.ds_license')} data-testid="pub-ds-license">{LICENSES.map((l) => <option key={l} value={l}>{l}</option>)}</Select>
          </Field>
          {needsDeclaration && (
            <Field>
              <FieldLabel>{t('teach.pub.decl_source')}</FieldLabel>
              <Select value={declSource} onChange={(e) => setDeclSource(e.target.value as 'own' | 'public' | 'licensed')} aria-label={t('teach.pub.decl_source')} data-testid="pub-decl-source">
                <option value="own">{t('teach.pub.decl_own')}</option>
                <option value="public">{t('teach.pub.decl_public')}</option>
                <option value="licensed">{t('teach.pub.decl_licensed')}</option>
              </Select>
            </Field>
          )}
        </Two>
      )}
      {access !== 'private' && (
        <Checkbox checked={includeNotes} onChange={(e) => setIncludeNotes(e.target.checked)} label={t('teach.pub.include_notes')} data-testid="pub-include-notes" />
      )}
      <div>
        <FieldLabel>{t('teach.pub.payout')}</FieldLabel>
        <Radios style={{ marginTop: 8 }}>
          <label><input type="radio" name="payout" checked={payoutMode === 'key'} onChange={() => setPayoutMode('key')} />{t('teach.pub.payout_key', { short: shortKey(teacherKey.address) })}</label>
          <label><input type="radio" name="payout" checked={payoutMode === 'wallet'} onChange={() => setPayoutMode('wallet')} />{t('teach.pub.payout_wallet')}</label>
          {payoutMode === 'wallet' && <Input value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder={t('teach.pub.wallet_ph')} aria-label={t('teach.pub.payout_wallet')} style={{ marginLeft: 28, width: 'calc(100% - 28px)' }} />}
          {walletBad && <HelperText $error style={{ marginLeft: 28 }}>{t('teach.key.payout_invalid')}</HelperText>}
          <label><input type="radio" name="payout" checked={payoutMode === 'none'} onChange={() => setPayoutMode('none')} />{t('teach.pub.payout_none')}</label>
        </Radios>
      </div>
      <Alert $tone="info">{t('teach.pub.split', { contributor: payoutMode === 'none' ? 0 : pct(policy.shares.contributor), node: nodeName, lineage: pct(policy.shares.lineage) })}</Alert>
      <Consents>
        <Checkbox checked={consentPermanent} onChange={(e) => setConsentPermanent(e.target.checked)} label={t('teach.pub.consent_permanent')} data-testid="consent-permanent" />
        <Checkbox checked={consentRights} onChange={(e) => setConsentRights(e.target.checked)} label={t('teach.pub.consent_rights')} data-testid="consent-rights" />
        {needsDeclaration && (
          <Checkbox
            checked={consentData} onChange={(e) => setConsentData(e.target.checked)} data-testid="consent-declaration"
            label={t('teach.pub.declaration', { n: job.dataset?.rows ?? job.facts.length })}
          />
        )}
      </Consents>
      {error && <Alert $tone="error" role="alert">{error}</Alert>}
      <SheetFooter>
        <SheetNote style={{ marginRight: 'auto' }}>{t('teach.pub.signed_note')}</SheetNote>
        <Button variant="contained" onClick={() => { void submit(); }} disabled={disabled} loading={busy} loadingText={t('teach.pub.working')} data-testid="pub-submit">{t('teach.pub.button')}</Button>
      </SheetFooter>
    </Sheet>
  );
}
