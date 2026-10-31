import { useAuth } from '@/auth/AuthContext';
import { useAinftBindingQuery } from '@/api/ainftBinding';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';

export function AinftBindingPanel({ agentId }: { agentId: string }) {
  const auth = useAuth();
  const { locale } = useT();
  const query = useAinftBindingQuery({ id: agentId, identity: auth.cacheIdentity }, { skip: auth.loading });
  if (query.isError) return <Alert $tone="error" role="alert" data-testid="ainft-binding-failed">
    {locale === 'ko' ? 'AINFT 연결을 확인하지 못했습니다.' : 'Could not verify the AINFT connection.'}{' '}
    <Button size="small" disabled={query.isFetching} onClick={() => void query.refetch()}>{locale === 'ko' ? '다시 확인' : 'Try again'}</Button>
  </Alert>;
  if (auth.loading || !query.currentData) return <p role="status">{locale === 'ko' ? 'AINFT 연결 확인 중…' : 'Checking AINFT connection…'}</p>;
  const binding = query.currentData.binding;
  if (!binding) return null;
  return <section data-testid="ainft-binding" style={{ marginTop: 20, overflowWrap: 'anywhere' }}>
    <h3>{locale === 'ko' ? '연결된 AINFT' : 'Linked AINFT'}</h3>
    <p>{binding.chainId === 0 ? 'TestNet' : 'MainNet'} · {binding.objectId} / {binding.tokenId}</p>
    <p>{locale === 'ko' ? '등록 확인 릴리스' : 'Verified registration release'}: {binding.release}</p>
    <small>{locale === 'ko' ? '등록 당시 지갑 검색에 반영된 기록입니다. 현재 보유자 권한을 보장하지 않습니다.' : 'Wallet indexing was verified at registration. This record does not grant current holder access.'}</small>
  </section>;
}
