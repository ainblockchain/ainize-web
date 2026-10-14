import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { useT } from '@/i18n';
import { AinftFactoryClient, createNativeAinftTokenId, registerAgentAsAinft, type AinftRegistration, type AinftWallet, type AinftChain } from '@/lib/ainftRegistration';

export function AinftRegistrationPanel({ agentId }: { agentId: string }) {
  const { locale } = useT();
  const text = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const [existing, setExisting] = useState(false);
  const [objectId, setObjectId] = useState(''), [tokenId, setTokenId] = useState('');
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<AinftRegistration | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true); setError(null);
    try {
      const wallet = (window as unknown as { ainetwork?: AinftWallet }).ainetwork;
      if (!wallet?.getAddress || !wallet.getNetwork || !wallet.signMessage || !wallet.sendTransaction) {
        throw new Error(text('AIN Wallet을 설치하고 잠금을 해제하세요.', 'Install and unlock AIN Wallet.'));
      }
      const address = await wallet.getAddress();
      if (!/^0x[0-9a-f]{40}$/i.test(address)) throw new Error('Invalid wallet address');
      const network = await wallet.getNetwork();
      if (network.chainId !== 0 && network.chainId !== 1) throw new Error(text('AIN MainNet 또는 TestNet을 선택하세요.', 'Select AIN MainNet or TestNet.'));
      const chainId = network.chainId as AinftChain;
      if (existing && (!/^0x[0-9a-f]{40}$/i.test(objectId) || !/^[A-Za-z0-9_-]{1,128}$/.test(tokenId))) throw new Error(text('올바른 컬렉션 주소와 토큰 ID를 입력하세요.', 'Enter a valid collection address and token ID.'));
      const key = `ainize.ainft.v1:${agentId}:${chainId}:${address.toLowerCase()}${existing ? `:existing:${objectId.toLowerCase()}:${tokenId}` : ''}`;
      const saved = localStorage.getItem(key);
      const next: AinftRegistration = saved ? JSON.parse(saved) : {
        agentId, address, chainId, objectId: existing ? objectId : null, tokenId: existing ? tokenId : createNativeAinftTokenId(), stage: existing ? 'mint' : 'new', pending: null, transactions: {},
      };
      if (next.agentId !== agentId || next.chainId !== chainId || next.address.toLowerCase() !== address.toLowerCase()) throw new Error('Registration identity mismatch');
      setState(next);
      const response = await fetch(`/api/hosted-agents/${encodeURIComponent(agentId)}/ainft-metadata`, { credentials: 'include' });
      if (!response.ok) throw new Error(text('에이전트 metadata를 읽을 수 없습니다.', 'Could not read agent metadata.'));
      const metadata = await response.json();
      if (metadata?.ainize?.agentId !== agentId || metadata.ainize.schemaVersion !== 1) throw new Error('Invalid agent metadata');
      const save = (value: AinftRegistration) => { localStorage.setItem(key, JSON.stringify(value)); setState(value); };
      // Persist the token ID before any signing or transaction request.
      save(next);
      const registered = await registerAgentAsAinft(new AinftFactoryClient(chainId, wallet), next, existing ? { ainize: metadata.ainize } : metadata, save);
      const binding = await fetch(`/api/hosted-agents/${encodeURIComponent(agentId)}/ainft-binding`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chainId, objectId: registered.objectId, tokenId: registered.tokenId, address: registered.tokenOwner ?? address }),
      });
      if (!binding.ok) {
        const failure = await binding.json().catch(() => null);
        throw new Error(failure?.error?.message ?? text('서버의 NFT 연결 확인이 실패했습니다. 다시 확인하세요.', 'Server binding verification failed. Check registration again.'));
      }
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };
  const stages = {
    new: text('컬렉션 준비', 'Prepare collection'),
    collection: text('토큰 민팅', 'Mint token'),
    mint: text('metadata 공개', 'Publish metadata'),
    metadata: text('지갑 검색 반영 확인', 'Confirm wallet indexing'),
    indexed: text('지갑 검색 확인 완료', 'Wallet discovery verified'),
  };
  return <section style={{ marginTop: 20 }} data-testid="ainft-registration">
    <h4>{text('AINFT로 등록', 'Register as AINFT')}</h4>
    <p>{text('AIN Wallet에서 선택한 네트워크·계정으로 등록합니다. 지갑에서 컬렉션 생성·민팅·metadata 공개를 승인합니다.', 'Register on the network and account selected in AIN Wallet. Approve collection creation, minting and metadata publication in the wallet.')}</p>
    <label style={{ display: 'block', marginBottom: 12 }}><input type="checkbox" checked={existing} disabled={busy} onChange={(event) => { setExisting(event.target.checked); setState(null); setError(null); }} /> {text('기존 AINFT 연결', 'Connect existing AINFT')}</label>
    {existing && <div style={{ marginBottom: 12 }}>
      <p>{text('선택한 지갑이 컬렉션 관리자여야 합니다. 현재 토큰 보유자는 검색 결과로 확인합니다. 기존 이름·이미지·설정은 유지하고 Ainize 연결 정보만 추가합니다.', 'The selected wallet must own the collection. The current token holder is verified from the index. Existing name, image and settings are preserved; only the Ainize link is added.')}</p>
      <input aria-label={text('컬렉션 주소', 'Collection address')} placeholder="0x…" value={objectId} disabled={busy} onChange={(event) => { setObjectId(event.target.value.trim()); setState(null); }} />
      <input aria-label={text('토큰 ID', 'Token ID')} placeholder="Token ID" value={tokenId} disabled={busy} onChange={(event) => { setTokenId(event.target.value.trim()); setState(null); }} />
    </div>}
    <Button size="small" variant="outlined" loading={busy} onClick={() => void run()}>
      {text(state ? '등록 상태 확인·계속' : '지갑으로 등록', state ? 'Check and continue registration' : 'Register with wallet')}
    </Button>
    {state && <div style={{ marginTop: 12 }} aria-live="polite">
      <p>{stages[state.stage]}{state.pending ? text(' · 트랜잭션 확인 대기', ' · Awaiting transaction confirmation') : ''}</p>
      {state.objectId && <p style={{ overflowWrap: 'anywhere' }}>{state.objectId} / {state.tokenId}</p>}
      {state.stage === 'indexed' && <p style={{ overflowWrap: 'anywhere' }}>{text('AIN Wallet의 같은 네트워크에서 아래 보유 계정의 AINFT 탭을 확인하세요.', 'Open the AINFT tab on the same network using the holder account below.')}<br />{state.tokenOwner ?? state.address}</p>}
    </div>}
    {error && <Alert $tone="error" style={{ marginTop: 12 }}>{error}</Alert>}
  </section>;
}
