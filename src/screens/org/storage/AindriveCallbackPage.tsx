/**
 * `/org/storage/aindrive` — where AinDrive sends the browser back after **Connect AinDrive** on an organization's
 * Settings → Storage (StorageTab's BackupTargetPanel). The query carries `code` and `state` (or `error`); the page posts
 * both to the node (`POST /api/storage/aindrive/callback`), which exchanges the code with the PKCE verifier it kept,
 * probes the drive and makes the grant the organization's backup target — then the page returns to that Storage tab.
 * The node checks that the caller is an admin of the organization that started the connect; the state is single-use.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useFinishAindriveConnectMutation } from '@/api/api';
import { AINDRIVE_CONNECT_ORG_KEY } from '@/api/projectStorage';
import { Alert } from '@/components/ui/Form';
import { CenterProgress, PageWrapper, StyledLink, Title } from '@/components/ui/Misc';
import { Help, Panel, storageErrorText } from '@/components/storage/common';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';

const startedOrg = (): string | null => { try { return sessionStorage.getItem(AINDRIVE_CONNECT_ORG_KEY); } catch { return null; } };
const settingsOf = (orgId: string, extra = '') => `/org/${encodeURIComponent(orgId)}/settings?tab=storage${extra}`;

export default function AindriveCallbackPage() {
  const { t } = useT();
  useTitle(t('storage.org.callback_title'));
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const [finish] = useFinishAindriveConnectMutation();
  const [err, setErr] = useState<string | null>(null);
  const sent = useRef(false);
  const code = search.get('code');
  const state = search.get('state');
  const denied = search.get('error');
  const orgId = startedOrg();

  useEffect(() => {
    if (sent.current || denied || !code || !state) return;
    sent.current = true; // one exchange per page: the state is single-use on the node
    void finish({ state, code }).unwrap()
      .then((r) => {
        try { sessionStorage.removeItem(AINDRIVE_CONNECT_ORG_KEY); } catch { /* nothing kept */ }
        navigate(settingsOf(r.orgId, '&aindrive=connected'), { replace: true });
      })
      .catch((e: unknown) => setErr(storageErrorText(t, e)));
  }, [code, state, denied, finish, navigate, t]);

  const failure = denied ? t('storage.org.callback_denied', { error: search.get('error_description') ?? denied }) : !code || !state ? t('storage.org.callback_missing') : err;
  return (
    <PageWrapper>
      <Title>{t('storage.org.callback_title')}</Title>
      <Panel>
        {failure ? <Alert $tone="error">{failure}</Alert> : <><CenterProgress /><Help>{t('storage.org.callback_working')}</Help></>}
        {failure && orgId && <StyledLink to={settingsOf(orgId)}>{t('storage.org.callback_back')}</StyledLink>}
      </Panel>
    </PageWrapper>
  );
}
