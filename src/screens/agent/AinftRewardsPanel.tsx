import { useRef, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { useActiveView } from '@/hooks/useActiveView';
import { Button } from '@/components/ui/Button';
import { rewardsView, type CompanionRewards as Rewards } from '@/lib/ainftCompanionViews';
export function AinftRewardsPanel({agentId,address,userId,text,disabled=false}:{disabled?:boolean;agentId:string;address:string;userId:string;text:(ko:string,en:string)=>string}) {
  const auth = useAuth(), active = useActiveView();
  const flight = useRef(false);
  const identity=JSON.stringify([agentId,address.toLowerCase(),userId,auth.cacheIdentity]);
  const current=useRef(identity);current.current=identity;
  const isCurrent = () => active() && auth.isCurrentAccount() && current.current === identity;
  const [snapshot,setSnapshot]=useState<{identity:string;data:Rewards}|null>(null);
  const [operation,setOperation]=useState<{identity:string;busy:boolean;error:string|null}|null>(null);
  const state=snapshot?.identity===identity?snapshot.data:null,busy=disabled||(operation?.identity===identity&&operation.busy);
  const base=`/api/hosted-agents/${encodeURIComponent(agentId)}/companion/credits`;
  const load=async()=>{
    if (!isCurrent()) throw new Error('Holder workspace changed');
    const response=await fetch(base+'/rewards',{credentials:'include',cache:'no-store',redirect:'error'});
    if(!response.ok)throw new Error(text('보상 상태를 확인할 수 없습니다.', 'Cannot check reward status.'));
    const data=rewardsView(await response.json());
    if(isCurrent())setSnapshot({identity,data});
  };
  const run=async(fn:()=>Promise<void>)=>{
    if (disabled || flight.current || !isCurrent()) return;
    flight.current = true;
    setOperation({identity,busy:true,error:null});
    try {await fn();if(isCurrent())setOperation({identity,busy:false,error:null});}
    catch(error){if(isCurrent()){setSnapshot(null);setOperation({identity,busy:false,error:error instanceof Error?error.message:String(error)});}}
    finally { flight.current = false; }
  };
  return <div>
    <Button size="small" disabled={busy||!userId} onClick={()=>void run(load)}>{text('보상 연결·지급 상태 확인','Check reward connection and delivery')}</Button>
    {operation?.identity===identity&&operation.error&&<p role="alert">{operation.error}</p>}
    {state&&<>
      {!state.available?<p>{text('이 서버의 커뮤니티 보상이 아직 활성화되지 않았습니다.','Community rewards are not enabled on this server yet.')}</p>:<>
        <p>{state.enrollment ? `${state.enrollment.appId} · ${state.enrollment.symbol} · ${state.enrollment.userId}` : text('보상 계정이 연결되지 않았습니다.','No reward account is connected.')}</p>
        <p>{text('연결 후 완료한 작업과 처음 승인한 기억만 보상 대상입니다. 지급액은 커뮤니티 정책에 따릅니다.','Only work completed and memories first approved after enrollment are eligible. Amounts follow the community policy.')}</p>
        <Button size="small" disabled={busy||state.enrollment?.userId===userId} onClick={()=>void run(async()=>{
          if(!isCurrent())throw new Error('Holder workspace changed');
          const response=await fetch(base+'/enroll',{method:'POST',credentials:'include',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId})});
          if(!response.ok)throw new Error(text('커뮤니티 정책과 지갑 계정의 연결을 확인할 수 없습니다.','Cannot verify the community policy and linked wallet account.'));
          await load();
        })}>{text('이 계정으로 보상 연결','Connect this reward account')}</Button>
      </>}
      {state.rewards.slice(-20).reverse().map(reward=><p key={reward.eventId}>{reward.kind==='completed_work'?text('작업 완료','Work completed'):text('기억 승인','Memory approved')} · {reward.appId} / {reward.symbol} · {reward.state==='confirmed'?text('지급 확인됨','Delivery confirmed'):text('지급 확인 대기','Awaiting delivery confirmation')}</p>)}
    </>}
  </div>;
}
