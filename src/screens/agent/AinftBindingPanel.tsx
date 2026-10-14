import { useEffect, useState } from 'react';
import { useT } from '@/i18n';
interface Binding { chainId: number; objectId: string; tokenId: string; release: number; verifiedAt: number }
export function AinftBindingPanel({ agentId }: { agentId: string }) {
  const { locale } = useT();
  const [binding, setBinding] = useState<Binding | null>(null);
  useEffect(() => {
    let active = true;
    setBinding(null);
    void fetch(`/api/hosted-agents/${encodeURIComponent(agentId)}/ainft-binding`, { credentials: 'include' })
      .then(async (response) => response.ok ? response.json() : null)
      .then((response) => { if (active && response?.binding) setBinding(response.binding); })
      .catch(() => {});
    return () => { active = false; };
  }, [agentId]);
  if (!binding) return null;
  return <section data-testid="ainft-binding" style={{ marginTop: 20, overflowWrap: 'anywhere' }}>
    <h3>{locale === 'ko' ? '연결된 AINFT' : 'Linked AINFT'}</h3>
    <p>{binding.chainId === 0 ? 'TestNet' : 'MainNet'} · {binding.objectId} / {binding.tokenId}</p>
    <p>{locale === 'ko' ? '등록 확인 릴리스' : 'Verified registration release'}: {binding.release}</p>
    <small>{locale === 'ko' ? '등록 당시 지갑 검색에 반영된 기록입니다. 현재 보유자 권한을 보장하지 않습니다.' : 'Wallet indexing was verified at registration. This record does not grant current holder access.'}</small>
  </section>;
}
