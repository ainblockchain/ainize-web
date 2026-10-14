import { useRef, useState } from 'react';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
export function AinftCommunityPanel({ agentId }: { agentId: string }) {
  const { locale } = useT(); const text = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const current = useRef(agentId); current.current = agentId;
  const [draft, setDraft] = useState<{ agentId: string; version: number; appId: string; symbol: string } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const active = draft?.agentId === agentId ? draft : null;
  const run = async (save: boolean, disable = false) => {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/hosted-agents/${encodeURIComponent(agentId)}/${save ? 'ainft-community' : 'ainft-binding'}`, {
        credentials: 'include', cache: 'no-store', ...(save && active ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedVersion: active.version, community: disable ? null : { appId: active.appId.trim(), symbol: active.symbol.trim() } }) } : {}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? 'Community configuration is unavailable');
      if (!result.binding) throw new Error(text('먼저 AINFT 등록과 연결을 완료하세요.', 'Complete AINFT registration and binding first.'));
      if (current.current === agentId) setDraft({ agentId, version: result.binding.communityVersion ?? 0, appId: result.binding.community?.appId ?? '', symbol: result.binding.community?.symbol ?? '' });
    } catch (failure) { if (current.current === agentId) setError(String(failure)); }
    finally { if (current.current === agentId) setBusy(false); }
  };
  return <section style={{ marginTop: 20 }}>
    <h4>{text('커뮤니티 크레딧 연결', 'Community credit connection')}</h4>
    <p>{text('기존 Factory 커뮤니티와 크레딧을 지정합니다. 보유자는 자신의 연결된 Factory 사용자 계정으로 잔액을 확인합니다. 잔액을 새로 만들거나 보상을 지급하지 않습니다.', 'Choose an existing Factory community and credit. Holders check balances using their linked Factory user accounts. This does not create balances or award credits.')}</p>
    <Button size="small" disabled={busy} onClick={() => void run(false)}>{text('연결 설정 확인', 'Check connection settings')}</Button>
    {active && <div>
      <input aria-label={text('커뮤니티 ID', 'Community ID')} placeholder={text('커뮤니티 ID', 'Community ID')} maxLength={128} disabled={busy} value={active.appId} onChange={(event) => setDraft({ ...active, appId: event.target.value })} />
      <input aria-label={text('크레딧 기호', 'Credit symbol')} placeholder={text('크레딧 기호', 'Credit symbol')} maxLength={128} disabled={busy} value={active.symbol} onChange={(event) => setDraft({ ...active, symbol: event.target.value })} />
      <Button size="small" disabled={busy || !active.appId.trim() || !active.symbol.trim()} onClick={() => void run(true)}>{text('크레딧 연결 저장', 'Save credit connection')}</Button>
      <Button size="small" variant="text" disabled={busy} onClick={() => void run(true, true)}>{text('크레딧 연결 해제', 'Disconnect credits')}</Button>
    </div>}
    {error && <Alert $tone="error">{error}</Alert>}
  </section>;
}
