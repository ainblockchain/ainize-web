import { useEffect, useRef, useState } from 'react';
import { useT } from '@/i18n';
import { useAuth } from '@/auth/AuthContext';
import { useActiveView } from '@/hooks/useActiveView';
import { errorMessage } from '@/api/api';
import { useAinftBindingQuery, useSaveAinftCommunityMutation } from '@/api/ainftBinding';
import type { AinftBinding } from '@/lib/ainftBinding';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';

type Draft = { version: number; appId: string; symbol: string };
const draftOf = (binding: AinftBinding): Draft => ({ version: binding.communityVersion, appId: binding.community?.appId ?? '', symbol: binding.community?.symbol ?? '' });
export function AinftCommunityPanel({ agentId }: { agentId: string }) {
  const { cacheIdentity } = useAuth();
  return <Community key={JSON.stringify([agentId, cacheIdentity])} agentId={agentId} />;
}
function Community({ agentId }: { agentId: string }) {
  const auth = useAuth();
  const active = useActiveView();
  const pending = useRef(false);
  const { locale } = useT(); const text = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const [opened, setOpened] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const query = useAinftBindingQuery({ id: agentId, identity: auth.cacheIdentity }, { skip: !opened || auth.loading });
  const [save, saving] = useSaveAinftCommunityMutation();
  const binding = query.error ? undefined : query.currentData?.binding;
  const busy = query.isFetching || saving.isLoading;
  const changed = !!draft && !!binding && binding.communityVersion !== draft.version;
  useEffect(() => { if (opened && binding && !draft && !busy) setDraft(draftOf(binding)); }, [opened, binding, draft, busy]);
  const refresh = () => {
    if (pending.current) return;
    setOpened(true); setDraft(null); setError(null); setNotice(null);
    if (opened && !query.isUninitialized) void query.refetch();
  };
  const run = async (disconnect = false) => {
    if (pending.current || busy || !draft || !binding || changed || !active() || !auth.isCurrentAccount()) return;
    pending.current = true; setError(null); setNotice(null);
    try {
      const result = await save({ id: agentId, identity: auth.cacheIdentity, body: { expectedVersion: draft.version, community: disconnect ? null : { appId: draft.appId.trim(), symbol: draft.symbol.trim() } } }).unwrap();
      if (active() && auth.isCurrentAccount()) {
        setDraft(draftOf(result));
        setNotice(disconnect ? text('크레딧 연결이 해제되었습니다.', 'Credit connection disconnected.') : text('크레딧 연결을 저장했습니다.', 'Credit connection saved.'));
      }
    } catch (failure) { if (active() && auth.isCurrentAccount()) setError(errorMessage(failure)); }
    finally { pending.current = false; }
  };
  return <section style={{ marginTop: 20, overflowWrap: 'anywhere' }} data-testid="ainft-community">
    <h4>{text('커뮤니티 크레딧 연결', 'Community credit connection')}</h4>
    <p>{text('기존 Factory 커뮤니티와 크레딧을 지정합니다. 보유자는 자신의 연결된 Factory 사용자 계정으로 잔액을 확인합니다.', 'Choose an existing Factory community and credit. Holders check balances using their linked Factory user accounts.')}</p>
    <Button size="small" disabled={busy || auth.loading} onClick={refresh}>{opened ? text('저장된 설정 다시 불러오기', 'Reload saved settings') : text('연결 설정 확인', 'Check connection settings')}</Button>
    {opened && query.isError && <Alert $tone="error" role="alert">{text('연결 설정을 읽지 못했습니다. 다시 불러와 주세요.', 'Could not read connection settings. Reload to try again.')}</Alert>}
    {opened && binding === null && <p>{text('먼저 AINFT 등록과 연결을 완료하세요.', 'Complete AINFT registration and binding first.')}</p>}
    {opened && binding && draft && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
      <input style={{ maxWidth: '100%', boxSizing: 'border-box' }} aria-label={text('커뮤니티 ID', 'Community ID')} maxLength={128} disabled={busy} value={draft.appId} onChange={(event) => { setNotice(null); setDraft({ ...draft, appId: event.target.value }); }} />
      <input style={{ maxWidth: '100%', boxSizing: 'border-box' }} aria-label={text('크레딧 기호', 'Credit symbol')} maxLength={128} disabled={busy} value={draft.symbol} onChange={(event) => { setNotice(null); setDraft({ ...draft, symbol: event.target.value }); }} />
      <Button size="small" disabled={busy || changed || !draft.appId.trim() || !draft.symbol.trim()} onClick={() => void run()}>{text('크레딧 연결 저장', 'Save credit connection')}</Button>
      <Button size="small" variant="text" disabled={busy || changed || !binding.community} onClick={() => void run(true)}>{text('크레딧 연결 해제', 'Disconnect credits')}</Button>
    </div>}
    {changed && <p role="status">{text('저장된 설정이 변경되었습니다. 다시 불러온 뒤 저장하세요.', 'Saved settings changed. Reload before saving.')}</p>}
    {notice && <p role="status">{notice}</p>}
    {error && <Alert $tone="error" role="alert">{error}</Alert>}
  </section>;
}
