import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useInfoQuery, usePublishChallengeMutation, usePublishPreviewQuery, usePublishTeachJobMutation } from '@/api/api';
import { TEACH_SAMPLES_ON_CHAIN } from '@ainize/core/browser';
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
/**
 * Finding 39 — the consent says "the questions, answers, my display name and payout address cannot be edited or
 * deleted", and the sheet showed none of them. This is that list, read-only, immediately above the checkboxes: every
 * question and answer as it will be written, the name and the address exactly as they will appear, and which of the
 * questions go into the public record itself rather than into the training set the access choice governs.
 */
const Record = styled.section`
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 6px; background: #fafafa; padding: 12px 14px;
  h3 { margin: 0 0 4px; font-size: 13px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; }
  p.sub { margin: 0 0 8px; font-size: 12px; line-height: 1.5; color: ${(p) => p.theme.color.GREY}; }
  ol { margin: 0; padding: 0; list-style: none; max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
  li { font-size: 12.5px; line-height: 1.5; color: ${(p) => p.theme.color.DARK_GREY}; word-break: break-word; }
  li .q { font-weight: 600; color: ${(p) => p.theme.color.BLACK}; }
  li .a b { color: ${(p) => p.theme.color.PRIMARY}; }
  li .alt { color: ${(p) => p.theme.color.GREY}; }
  li .on { margin-left: 6px; padding: 1px 7px; border-radius: 9px; font-size: 11px; font-weight: 600; background: #f5eefc; color: #5b1ca8; white-space: nowrap; }
  dl { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 12px; margin: 10px 0 0; font-size: 12px; }
  dt { color: ${(p) => p.theme.color.GREY}; }
  dd { margin: 0; color: ${(p) => p.theme.color.DARK_GREY}; word-break: break-all; }
`;

/**
 * Finding 40 — an irreversible legal choice was five raw SPDX identifiers with no helper text, in one list with
 * "Proprietary", defaulting to CC-BY-4.0, on a flow whose premise is "no account needed". Each option now says in
 * plain language what it lets a reader do, in both locales, and the field says the choice cannot be changed.
 */
const LICENSES: { id: string; key: string }[] = [
  { id: 'CC-BY-4.0', key: 'teach.pub.lic.cc_by' },
  { id: 'CC-BY-SA-4.0', key: 'teach.pub.lic.cc_by_sa' },
  { id: 'CC0-1.0', key: 'teach.pub.lic.cc0' },
  { id: 'ODC-By-1.0', key: 'teach.pub.lic.odc_by' },
  { id: 'Proprietary', key: 'teach.pub.lic.proprietary' },
];

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
  /** item 298 — a node with fewer verifier peers than its quorum cannot put this on sale; publishing anyway is a choice. */
  const [anyway, setAnyway] = useState(false);
  const [dsLicense, setDsLicense] = useState('CC-BY-4.0');
  const [includeNotes, setIncludeNotes] = useState(false);
  const [declSource, setDeclSource] = useState<'own' | 'public' | 'licensed'>('own');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublishResponse | null>(null);

  const bases = job.bases ?? [];
  const baseNames = bases.map((b) => b.name ?? b.patch_id).join(', ');
  // a base that is not listed yet blocks the publish server-side (`parent_not_listed`) — say so before the button
  const unlisted = bases.filter((b) => b.status && !['VERIFIED', 'ANNOUNCED', 'VERIFYING'].includes(b.status));
  const currency = info?.currency ?? 'CREDIT';
  const nodeName = info?.node.name ?? 'This node';
  /** finding 342 — what the peers that verify this are paid out of each sale, as this node reports it */
  const verifierPct = Math.round((policy.shares.verifier ?? 0) * 1000) / 10;

  /**
   * SC-8 money (item 186). The node computes the real split with the same `royaltySplit` that settles a sale — the
   * sheet used to render `policy.shares.contributor` alone and promise "70 % of every sale" where a lesson with a
   * parent pays 49 %, because the lineage pool comes off the top and the contributor share is carved out of the rest.
   * This is the same GET the submit path signs, read as a query so the numbers are on screen before the price is typed.
   */
  const payoutForPreview = payoutMode === 'none' ? null : payoutMode === 'wallet' ? (isAddress(wallet.trim()) ? wallet.trim() : undefined) : undefined;
  const { data: preview } = usePublishPreviewQuery({ id: job.id, payout_address: payoutForPreview });
  const split = preview?.split_preview;
  const verification = preview?.verification ?? policy.verification;
  const ledgerKind = preview?.ledger?.kind ?? policy.ledger?.kind ?? (currency === 'CREDIT' ? 'local' : undefined);
  /** item 299 — on a local-ledger node the price is denominated in credit this node mints and no wallet can spend. */
  const playMoney = ledgerKind === 'local';
  /** item 298 — no quorum reachable here means the price/payout ceremony cannot end in a sale. */
  const cannotSell = !!verification && verification.verifiers < verification.quorum;

  // A child priced 0 pays its parents 0, so "the creators share in sales" is empty by default: when the node knows
  // what the parent asks, that is the number the field starts at (the creator can still type anything).
  const [priceTouched, setPriceTouched] = useState(false);
  useEffect(() => {
    if (priceTouched || !split?.suggested_price) return;
    if (price !== '0') return;
    setPrice(split.suggested_price);
  }, [split?.suggested_price, priceTouched, price]);

  /** What the typed price pays each line — `royaltySplit` is proportional, so the unit shares scale exactly. */
  const money = useMemo(() => {
    const p = Number(price.trim());
    if (!split || !Number.isFinite(p)) return null;
    const fmt = (n: number) => String(Math.round(n * 1e6) / 1e6);
    return split.shares.map((sh) => ({ ...sh, amount: fmt(sh.share * p), percent: Math.round(sh.share * 1000) / 10 }));
  }, [split, price]);
  const mine = money?.find((m) => m.kind === 'you');
  const nodeLine = money?.find((m) => m.kind === 'node');
  const lineage = money?.filter((m) => m.kind === 'lineage') ?? [];
  const lineagePct = Math.round(lineage.reduce((n, l) => n + l.share, 0) * 1000) / 10;
  const lineageNames = split?.parents.length ? split.parents.map((x) => x.name).join(', ') : baseNames;

  const nameBad = name.trim().length < 2 || name.trim().length > 80;
  const priceBad = !/^\d+(\.\d+)?$/.test(price.trim());
  const walletBad = payoutMode === 'wallet' && !isAddress(wallet.trim());
  const declarationRows = policy.limits?.declaration_rows ?? 100;
  const needsDeclaration = (job.dataset?.rows ?? job.facts.length) >= declarationRows;
  const consentBad = !consentPermanent || !consentRights || (needsDeclaration && !consentData);
  const disabled = nameBad || priceBad || walletBad || consentBad || (cannotSell && !anyway) || busy;

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
        <Alert $tone={result.status === 'ANNOUNCED' && cannotSell ? 'warning' : 'success'} role="status" data-testid="publish-done">
          {result.status !== 'ANNOUNCED' ? t('teach.pub.done_review')
            : cannotSell ? t('teach.pub.done_no_verifiers', { quorum: verification?.quorum ?? info?.quorum ?? 2, n: verification?.verifiers ?? 0 })
              : t('teach.pub.done_auto', { quorum: verification?.quorum ?? info?.quorum ?? 2 })}
        </Alert>
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
          {/* SC-8: what the base asks is the number a creator is undercutting or matching — show it above the field */}
          {!!split?.parents.length && (
            <HelperText data-testid="pub-parent-price">
              {t('teach.pub.parent_price', { name: split.parents.map((x) => x.name).join(', '), price: split.parents[split.parents.length - 1].price ?? '0', currency })}
            </HelperText>
          )}
          <Input value={price} onChange={(e) => { setPriceTouched(true); setPrice(e.target.value); }} inputMode="decimal" aria-label={t('teach.pub.price', { currency })} data-testid="pub-price" />
          {priceBad && <HelperText $error>{t('teach.pub.v_price')}</HelperText>}
          {/* item 299: this node settles in credit it mints for every address it sees — say so where the price is typed */}
          {playMoney && <HelperText data-testid="pub-credit-note">{t('price.credit_note')}</HelperText>}
          {mine && !priceBad && (
            <HelperText data-testid="pub-your-cut">{t('teach.pub.you_get', { amount: mine.amount, currency, percent: mine.percent })}</HelperText>
          )}
        </Field>
      </Two>
      <Field>
        <FieldLabel>{t('teach.pub.license')}</FieldLabel>
        <Select value={license} onChange={(e) => setLicense(e.target.value)} aria-label={t('teach.pub.license')} data-testid="pub-license">
          {LICENSES.map((l) => <option key={l.id} value={l.id}>{t(l.key)}</option>)}
        </Select>
        <HelperText data-testid="pub-license-permanent">{t('teach.pub.license_permanent')}</HelperText>
      </Field>

      {/* SC-8: what this was built on is part of the publish decision — it is who gets paid, and what buyers will need */}
      {bases.length > 0 && (
        <Alert $tone="info" data-testid="pub-built-on">
          {/* two §4 sentences, and "Built on: {names}" ends in a name rather than a full stop: on one line they read
              as "Built on: X Every sale: 30% to the creators of X…" */}
          <div>{t('teach.pub.built_on', { names: baseNames })}</div>
          {/* item 186: the percentages are the node's own royaltySplit on this anchor's parents, not the raw policy
              share — a lesson with a parent pays its teacher 49 %, and the sentence used to promise 70 %. */}
          <div style={{ marginTop: 4 }}>{money
            ? t('teach.pub.money', { names: lineageNames, lineage: `${lineagePct}`, contributor: `${mine?.percent ?? 0}`, node: nodeName })
            : t('teach.pub.money', { names: baseNames, lineage: pct(policy.shares.lineage), contributor: payoutMode === 'none' ? 0 : pct(policy.shares.contributor), node: nodeName })}</div>
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
        {/* HelperText is a <span>: two of them in a row render as one sentence — "…protects only notes and untrained
            rows.Whoever takes them is recorded…" — so each of these two gets its own line. */}
        <HelperText style={{ display: 'block' }} data-testid="pub-ds-honesty">{t('teach.pub.ds_honesty', { n: Math.min(job.facts.length, TEACH_SAMPLES_ON_CHAIN) })}</HelperText>
        {/*
          Item 312 — "derivative" is not "on request": it is a recorded commitment. Whoever takes these questions is
          written down against their teaching key, and this node refuses to publish a lesson trained on them unless it
          names this knowledge as its base. The creator is told that before they choose, not after.
        */}
        <HelperText style={{ display: 'block', marginTop: 4 }} data-testid="pub-ds-terms">
          {access === 'public' ? t('teach.pub.ds_terms_public') : access === 'derivative' ? t('teach.pub.ds_terms_derivative') : t('teach.pub.ds_terms_private')}
        </HelperText>
      </div>
      {access !== 'private' && (
        <Two>
          <Field>
            <FieldLabel>{t('teach.pub.ds_license')}</FieldLabel>
            <Select value={dsLicense} onChange={(e) => setDsLicense(e.target.value)} aria-label={t('teach.pub.ds_license')} data-testid="pub-ds-license">
              {LICENSES.map((l) => <option key={l.id} value={l.id}>{t(l.key)}</option>)}
            </Select>
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
        {/* item 299: on a local-ledger node an AIN address is a place nothing will ever arrive — say so under the option */}
        {playMoney && <HelperText data-testid="pub-payout-note">{t('teach.pub.payout_credit', { node: nodeName })}</HelperText>}
      </div>
      {/*
        Item 186 — one sentence, the node's own numbers, no hedging. `royaltySplit` takes the lineage pool off the
        top and carves the contributor's share out of what is left, so the figure here is what a sale really pays;
        the old copy read the policy share directly and said "70 %" where the answer was 49 %, and hedged with "if
        you ticked builds on" on a job whose parents the node already knows.
      */}
      <Alert $tone="info" data-testid="pub-split">
        {money && mine
          ? lineage.length
            ? t('teach.pub.split_lineage', { contributor: `${mine.percent}`, lineage: `${lineagePct}`, names: lineageNames, node: nodeName, nodePct: `${nodeLine?.percent ?? 0}` })
            : t('teach.pub.split_plain', { contributor: `${mine.percent}`, node: nodeName, nodePct: `${nodeLine?.percent ?? 0}` })
          : t('teach.pub.split', { contributor: payoutMode === 'none' ? 0 : pct(policy.shares.contributor), node: nodeName, lineage: pct(policy.shares.lineage) })}
        {/*
          Finding 342 — the node's cut was justified with "training, hosting and verification", a cost the node does
          not bear: verification runs on other peers' GPUs. What they are paid is this node's own `shares.verifier`,
          carved from the seller side once an anchor actually has verifiers — so the sentence follows that number
          instead of asserting either story.
        */}
        <span style={{ display: 'block', marginTop: 4 }} data-testid="pub-split-verify">
          {verifierPct > 0 ? t('teach.pub.split_verify_paid', { pct: verifierPct }) : t('teach.pub.split_verify')}
        </span>
        {money && !priceBad && Number(price) > 0 && (
          <span data-testid="pub-split-amounts">{' '}{t('teach.pub.split_at', {
            price: price.trim(), currency,
            lines: money.filter((m) => Number(m.amount) > 0).map((m) => `${m.name ?? (m.kind === 'you' ? t('teach.pub.split_you') : m.kind === 'node' ? nodeName : m.address.slice(0, 10))} ${m.amount}`).join(' · '),
          })}</span>
        )}
      </Alert>
      {/*
        Item 298 — the sheet promised "it goes on sale when 2 agree" without ever asking whether two verifiers exist.
        On the node actually deployed for teaching there are none, and 136 lessons have been waiting up to 75 hours.
      */}
      {cannotSell && (
        <Alert $tone="warning" data-testid="pub-no-verifiers">
          {t('teach.pub.no_verifiers', { n: verification?.verifiers ?? 0, quorum: verification?.quorum ?? 2, node: nodeName })}
          <Checkbox
            checked={anyway} onChange={(e) => setAnyway(e.target.checked)} data-testid="pub-anyway"
            label={t('teach.pub.publish_anyway')}
          />
        </Alert>
      )}
      {/*
        Finding 39 — you cannot consent to irreversibility for content you cannot see. Everything the consent below
        enumerates, rendered read-only and directly above it: each question with its answer and its other phrasing,
        which of them go into the public record itself, and the name, address, price and licence as they will appear.
        (The reviewer asked for it "at the top"; it sits here instead, because the name, payout and price it must
        quote are typed above — at the top it would show empty fields, and the checkboxes it belongs to are here.)
      */}
      <Record data-testid="pub-record">
        <h3>{t('teach.pub.record_title')}</h3>
        <p className="sub">{t('teach.pub.record_sub', { n: job.facts.length, onchain: Math.min(job.facts.length, TEACH_SAMPLES_ON_CHAIN) })}</p>
        <ol data-testid="pub-record-facts">
          {job.facts.map((f, i) => (
            <li key={i}>
              <span className="q">{f.prompt}</span>
              {i < TEACH_SAMPLES_ON_CHAIN && <span className="on">{t('teach.pub.record_onchain')}</span>}
              <div className="a">{t('teach.basket.answer_label')}: <b>{f.answer}</b></div>
              {f.alt_prompt && <div className="alt">{t('teach.basket.alt_label')}: {f.alt_prompt}</div>}
            </li>
          ))}
        </ol>
        <dl>
          <dt>{t('teach.pub.shown_as')}</dt>
          <dd data-testid="pub-record-name">{job.contributor.name ?? teacherKey.name ?? t('teach.pub.shown_as_visitor')}</dd>
          <dt>{t('teach.pub.payout')}</dt>
          <dd data-testid="pub-record-payout">{payoutMode === 'none' ? t('teach.pub.payout_none') : payoutMode === 'wallet' ? (wallet.trim() || t('teach.pub.wallet_ph')) : teacherKey.address}</dd>
          <dt>{t('teach.pub.name')}</dt>
          <dd>{name.trim() || '—'}</dd>
          <dt>{t('teach.pub.price', { currency })}</dt>
          <dd>{price.trim() || '0'} {currency}</dd>
          <dt>{t('teach.pub.license')}</dt>
          <dd>{license}</dd>
        </dl>
      </Record>
      <Consents>
        {/* finding 41 — the share is written next to the name on the public page; the consent has to name it too */}
        <Checkbox checked={consentPermanent} onChange={(e) => setConsentPermanent(e.target.checked)} data-testid="consent-permanent"
          label={t('teach.pub.consent_permanent', { share: mine ? `${mine.percent}` : pct(policy.shares.contributor) })} />
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
