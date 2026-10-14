import { useRef, useState } from 'react';
import { AinftCreditClient } from '@/lib/ainftCredits';
import { AinftBenefitPurchase, benefitCatalog, type BenefitCatalog } from '@/lib/ainftBenefitPurchase';
import type { AinftChain, AinftWallet } from '@/lib/ainftRegistration';
import { Button } from '@/components/ui/Button';
interface Connection { chainId: AinftChain; version: number; executionAvailable?: boolean; allowedPolicyVersions?: number[]; community: { appId: string; symbol: string } | null }
export function AinftBenefitsPanel({ agentId, address, userId, text, selectedPurchase, onSelect }: { agentId: string; address: string; userId: string; selectedPurchase?: string; onSelect?: (purchaseId: string, policyVersion: number) => void; text: (ko: string, en: string) => string }) {
  const identity = JSON.stringify([agentId, address.toLowerCase(), userId]);
  const current = useRef(identity); current.current = identity;
  const [snapshot, setSnapshot] = useState<{ identity: string; connection: Connection; catalog: BenefitCatalog; pending: boolean } | null>(null);
  const [operation, setOperation] = useState<{ identity: string; busy: boolean; error: string | null } | null>(null);
  const state = snapshot?.identity === identity ? snapshot : null;
  const busy = operation?.identity === identity && operation.busy;
  const config = async (): Promise<Connection> => {
    const response = await fetch(`/api/hosted-agents/${encodeURIComponent(agentId)}/companion/credits`, { credentials: 'include', cache: 'no-store', redirect: 'error' });
    if (!response.ok) throw new Error(text('현재 보유자와 크레딧 연결을 확인할 수 없습니다.', 'Cannot verify the holder and credit connection.'));
    const value = await response.json() as Connection;
    if (![0,1].includes(value.chainId) || !Number.isSafeInteger(value.version) || !value.community) throw new Error(text('크레딧 연결이 없습니다.', 'No credit connection.'));
    if (value.allowedPolicyVersions !== undefined && (!Array.isArray(value.allowedPolicyVersions) || value.allowedPolicyVersions.some(version => !Number.isSafeInteger(version) || version < 1))) throw new Error('Invalid allowed benefit policies');
    if (current.current !== identity) throw new Error('Holder workspace changed');
    return value;
  };
  const resources = (connection: Connection) => {
    const wallet = (window as unknown as { ainetwork?: AinftWallet }).ainetwork;
    if (!wallet) throw new Error(text('AIN Wallet을 설치하고 잠금을 해제하세요.', 'Install and unlock AIN Wallet.'));
    const { appId, symbol } = connection.community!;
    const key = 'ainft-benefit-intent:' + JSON.stringify([identity, connection.chainId, appId, symbol]);
    return { client: new AinftCreditClient(connection.chainId, wallet), intent: new AinftBenefitPurchase(localStorage, key), appId, symbol };
  };
  const sameConnection = async (before: Connection) => {
    const after = await config();
    if (after.version !== before.version || after.chainId !== before.chainId || after.executionAvailable !== before.executionAvailable || JSON.stringify(after.allowedPolicyVersions) !== JSON.stringify(before.allowedPolicyVersions) || after.community?.appId !== before.community?.appId || after.community?.symbol !== before.community?.symbol) throw new Error(text('크레딧 연결이 변경되었습니다. 다시 조회하세요.', 'The credit connection changed. Refresh it.'));
  };
  const refresh = async (connection: Connection) => {
    const { client, intent, appId, symbol } = resources(connection);
    const catalog = benefitCatalog(await client.catalog(address, appId, symbol, agentId, userId), agentId, userId);
    await sameConnection(connection);
    await intent.reconcile(catalog, userId);
    if (current.current === identity) setSnapshot({ identity, connection, catalog, pending: !!intent.pending() });
  };
  const run = async (fn: () => Promise<void>) => {
    setOperation({ identity, busy: true, error: null });
    try { await fn(); if (current.current === identity) setOperation({ identity, busy: false, error: null }); }
    catch (error) { if (current.current === identity) setOperation({ identity, busy: false, error: error instanceof Error ? error.message : String(error) }); }
  };
  return <div>
    <Button size="small" disabled={busy || !userId} onClick={() => void run(async () => refresh(await config()))}>{text('혜택과 구매 내역 확인', 'Check benefits and purchases')}</Button>
    {operation?.identity === identity && operation.error && <p role="alert">{operation.error}</p>}
    {state && <>
      {state.pending && <p>{text('확인되지 않은 구매 요청이 있습니다. 내역을 새로 확인하거나 같은 요청을 다시 확인하세요.', 'A purchase is unconfirmed. Refresh the history or retry the same request.')}</p>}
      {state.connection.executionAvailable !== true && <p>{text('이 서버의 구매 혜택 실행 연결이 준비되면 새 구매를 사용할 수 있습니다. 기존 내역 조회와 환불은 가능합니다.', 'New purchases become available when this server supports benefit execution. Existing history and refunds remain available.')}</p>}
      {state.catalog.policy ? <div>
        <p>{state.catalog.policy.title}: {state.catalog.policy.unitCost} {state.connection.community!.symbol} / {state.catalog.policy.unitsPerPurchase} {text('회', 'uses')}</p>
        <p>{text('구매 금액은 작업 완료까지 보관됩니다. 미사용 구매는 지정된 환불 기간에 환불할 수 있습니다.', 'Payment is held until work completes. Unused purchases can be refunded within the stated window.')} {Math.floor(state.catalog.policy.refundWindowMs / 60000)} {text('분', 'minutes')}</p>
        <Button size="small" disabled={busy || (!state.pending && (!state.catalog.policy.active || state.connection.executionAvailable !== true || !state.connection.allowedPolicyVersions?.includes(state.catalog.policy.version)))} onClick={() => void run(async () => {
          await sameConnection(state.connection);
          const { client, intent, appId, symbol } = resources(state.connection);
          if (!intent.pending() && state.connection.executionAvailable !== true) throw new Error(text('이 서버는 구매한 혜택의 작업 실행을 아직 지원하지 않습니다.', 'This server does not support purchased benefit execution yet.'));
          const pending = intent.pending();
          if (!state.connection.allowedPolicyVersions?.includes(pending?.policyVersion ?? state.catalog.policy!.version)) throw new Error(text('이 정책은 작업에 사용할 수 없습니다. 구매 내역을 확인하세요.', 'This policy is not authorized for execution. Check purchase history.'));
          const request = intent.prepare(state.catalog.policy!.version);
          if (current.current !== identity) throw new Error('Holder workspace changed');
          try {
            await client.purchase(address, appId, symbol, agentId, userId, request.requestKey, request.policyVersion, request.quantity);
            await refresh(state.connection);
          } finally {
            if (current.current === identity) setSnapshot(previous => previous?.identity === identity ? { ...previous, pending: !!intent.pending() } : previous);
          }
        })}>{state.pending ? text('같은 구매 요청 재확인', 'Retry the same purchase') : text('크레딧으로 1개 구매', 'Buy one with credits')}</Button>
      </div> : <p>{text('게시된 혜택이 없습니다.', 'No published benefits.')}</p>}
      {state.catalog.purchases.map(receipt => <div key={receipt.id}>
        {state.connection.executionAvailable === true && receipt.status === 'active' && receipt.remaining > 0 && state.connection.allowedPolicyVersions?.includes(receipt.policyVersion) && <Button size="small" disabled={busy || selectedPurchase === receipt.id} onClick={() => onSelect?.(receipt.id, receipt.policyVersion)}>{selectedPurchase === receipt.id ? text('선택한 이용권', 'Selected allowance') : text('이 이용권으로 작업하기', 'Use this allowance for work')}</Button>}
        <p>{receipt.id.slice(0,12)} · {receipt.cost} {state.connection.community!.symbol} · {receipt.remaining}/{receipt.units} · {receipt.status}</p>
        {receipt.status === 'active' && !receipt.settled && receipt.remaining === receipt.units && receipt.refundUntil >= Date.now() && <Button size="small" disabled={busy} onClick={() => void run(async () => {
          await sameConnection(state.connection);
          const { client, appId, symbol } = resources(state.connection);
          await client.refund(address, appId, symbol, agentId, userId, receipt.id);
          await refresh(state.connection);
        })}>{text('미사용 구매 환불', 'Refund unused purchase')}</Button>}
      </div>)}
    </>}
  </div>;
}
