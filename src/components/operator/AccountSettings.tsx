import { useEffect, useMemo, useState, type FormEvent } from 'react';
import styled from 'styled-components';
import { errorMessage, useSettingsQuery, useUpdateSettingsMutation } from '@/api/api';
import { useAuth } from '@/auth/AuthContext';
import { useActiveView } from '@/hooks/useActiveView';
import { useT } from '@/i18n';
import { createSettingsSaveTask, NOTIFICATION_LEVELS, readAccountSettings, rebaseSettings, receiveSettings, settingsConflict, settingsDirty, settingsEditor, SettingsSaveError, type SettingsEditor, type SettingsFields } from '@/lib/accountSettings';
import { Alert, TextField } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { CenterProgress, CopyButton, Description, Mono, SubTitle } from '@/components/ui/Misc';
import { Muted, QueryError, RadioGroup, Row, Tip } from './common';

const Form = styled.form`margin-top: 16px; max-width: 640px;`;
const Fields = styled.fieldset`display: flex; flex-direction: column; gap: 18px; padding: 0; margin: 0; border: 0; min-width: 0;
  input { min-width: 0; max-width: 100%; }
`;

export function AccountSettings({ address }: { address: string | null }) {
  const { t, tech } = useT();
  const auth = useAuth(), active = useActiveView();
  const isCurrent = () => active() && auth.isCurrentAccount();
  const query = useSettingsQuery({ identity: auth.cacheIdentity });
  const server = useMemo(() => query.isError ? null : readAccountSettings(query.currentData), [query.currentData, query.isError]);
  const [editor, setEditor] = useState<SettingsEditor | null>(() => server ? settingsEditor(server) : null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [task] = useState(createSettingsSaveTask);
  const [update] = useUpdateSettingsMutation();
  useEffect(() => () => task.abandon(), [task]);
  useEffect(() => { if (server && !saving && !query.isFetching) setEditor(previous => receiveSettings(previous, server)); }, [server, saving, query.isFetching]);
  const view = editor ?? (server ? settingsEditor(server) : null);
  const ready = !!server && !query.isError && !query.isFetching;
  const dirty = !!view && settingsDirty(view);
  const conflict = !!view && !!server && settingsConflict(view, server);
  const edit = (patch: Partial<SettingsFields>) => {
    if (!view || task.pending()) return;
    setEditor({ ...view, draft: { ...view.draft, ...patch } }); setNotice(null); setError(null);
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!view || !ready || !dirty || conflict || task.pending() || !isCurrent()) return;
    setSaving(true); setNotice(null); setError(null);
    try {
      const result = await task.run(view, { active: isCurrent, read: () => query.refetch().unwrap(), write: patch => update(patch).unwrap() });
      if (!result || !isCurrent()) return;
      setEditor(settingsEditor(result.settings));
      setNotice(t(result.wrote ? 'op.account.settings.saved' : 'op.account.settings.unchanged'));
    } catch (err) {
      if (isCurrent()) setError(err instanceof SettingsSaveError ? t(`op.account.settings.error.${err.code}`) : errorMessage(err));
    } finally { if (isCurrent()) setSaving(false); }
  };
  return <>
    <SubTitle $mt={56}>{t('op.account.settings.title')}</SubTitle>
    <Description>{t('op.account.settings.desc')}</Description>
    {query.isFetching && !view && <CenterProgress />}
    {!query.isFetching && !server && <QueryError error={query.error} what={t('op.account.settings.title')} onRetry={() => void query.refetch()} retrying={query.isFetching} />}
    {view && <Form onSubmit={save} aria-busy={saving} data-testid="account-settings-form">
      {conflict && ready && !saving && <Alert role="alert" $tone="warning" data-testid="account-settings-conflict">
        {t('op.account.settings.conflict', { name: server!.display_name, notifications: t(`op.account.notif.${server!.notifications}`) })}
        <Row $wrap $gap={12} style={{ marginTop: 8 }}>
          <Button type="button" size="small" onClick={() => { setEditor(settingsEditor(server!)); setNotice(null); setError(null); }}>{t('op.account.settings.use_server')}</Button>
          <Button type="button" size="small" onClick={() => { setEditor(rebaseSettings(view, server!)); setNotice(null); setError(null); }}>{t('op.account.settings.keep_edits')}</Button>
        </Row>
      </Alert>}
      <Fields disabled={saving}>
        <TextField label={t('op.account.display_name')} helper={t('op.account.display_name.helper')} value={view.draft.display_name} maxLength={64} required onChange={e => edit({ display_name: e.target.value })} />
        <div data-testid="account-payout">
          <span style={{ fontSize: 12, color: '#8d8d8f', fontWeight: 500 }}><Tip tech={tech('lineage')}>{t('op.account.payout')}</Tip></span>
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <Mono>{address ?? '—'}</Mono>{address && <CopyButton text={address} label={t('common.copy')} />}
          </div>
          <Muted style={{ display: 'block', marginTop: 6 }}>{t('op.account.payout.fact')}</Muted>
          {!!view.base.payout_address && address && view.base.payout_address.toLowerCase() !== address.toLowerCase() && <Muted style={{ display: 'block', marginTop: 4, color: '#8a4b00' }} data-testid="account-payout-stale">
            {t('op.account.payout.stored', { address: view.base.payout_address })}
          </Muted>}
        </div>
        <div>
          <span style={{ fontSize: 12, color: '#8d8d8f', fontWeight: 500 }}>{t('op.account.notif')}</span>
          <RadioGroup role="radiogroup" aria-label={t('op.account.notif')}>
            {NOTIFICATION_LEVELS.map(level => <label key={level}><input type="radio" name="notifications" value={level} checked={view.draft.notifications === level} onChange={() => edit({ notifications: level })} />{t(`op.account.notif.${level}`)}</label>)}
          </RadioGroup>
        </div>
      </Fields>
      {error && <Alert role="alert" $tone="error" style={{ marginTop: 12 }}>{error}</Alert>}
      <Row $wrap $gap={12} style={{ marginTop: 18 }}>
        <Button type="submit" variant="contained" disabled={!ready || !dirty || conflict} loading={saving} loadingText={t('op.saving')}>{t('op.account.settings.save')}</Button>
        {notice && !dirty && <Muted role="status" style={{ color: '#44a45f' }}>{notice}</Muted>}
      </Row>
    </Form>}
  </>;
}
