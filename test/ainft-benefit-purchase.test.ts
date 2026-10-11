import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { AinftBenefitPurchase, benefitCatalog } from '../src/lib/ainftBenefitPurchase';
import { stableJson } from '../src/lib/ainftRegistration';
function storage() {
  const values = new Map<string,string>();
  return { getItem:(key:string)=>values.get(key)??null, setItem:(key:string,value:string)=>{values.set(key,value);}, removeItem:(key:string)=>{values.delete(key);} };
}
const policy={active:true,version:1,title:'Work allowance',unitCost:3,unitsPerPurchase:2,refundWindowMs:60000};
test('uncertain purchases retain the same saved key across reloads and policy changes', () => {
  const store=storage();
  const first=new AinftBenefitPurchase(store,'holder-one').prepare(1);
  const reloaded=new AinftBenefitPurchase(store,'holder-one');
  assert.deepEqual(reloaded.prepare(2),first);
  assert.equal(new AinftBenefitPurchase(store,'holder-two').pending(),null);
});
test('only the exact acknowledged purchase clears a pending intent', async () => {
  const store=storage(), purchase=new AinftBenefitPurchase(store,'holder');
  const intent=purchase.prepare(1);
  const fingerprint=createHash('sha256').update(stableJson({type:'purchase',agentId:'agent',userId:'user',...intent})).digest('hex');
  const row={id:'a'.repeat(64),fingerprint,agentId:'agent',userId:'user',policyVersion:1,cost:3,units:2,remaining:2,refundUntil:Date.now()+60000,status:'active',settled:false};
  const absent=benefitCatalog({agentId:'agent',policy,purchases:[{...row,fingerprint:'b'.repeat(64)}]},'agent','user');
  assert.equal(await purchase.reconcile(absent,'user'),null);
  assert.deepEqual(purchase.pending(),intent);
  const catalog=benefitCatalog({agentId:'agent',policy,purchases:[row]},'agent','user');
  assert.equal((await purchase.reconcile(catalog,'user'))?.id,row.id);
  assert.equal(purchase.pending(),null);
});
test('catalog rejects another holder, malformed policy and impossible allowances', () => {
  const row={id:'a'.repeat(64),fingerprint:'b'.repeat(64),agentId:'agent',userId:'other',policyVersion:1,cost:3,units:2,remaining:2,refundUntil:0,status:'active',settled:false};
  assert.throws(()=>benefitCatalog({agentId:'agent',policy,purchases:[row]},'agent','user'),/receipt/);
  assert.throws(()=>benefitCatalog({agentId:'agent',policy:{...policy,unitCost:-1},purchases:[]},'agent','user'),/policy/);
  assert.throws(()=>benefitCatalog({agentId:'agent',policy,purchases:[{...row,userId:'user',remaining:3}]},'agent','user'),/receipt/);
});
test('storage failures stop preparation before a purchase can be submitted', () => {
  const purchase=new AinftBenefitPurchase({...storage(),setItem:()=>{throw new Error('storage unavailable');}},'holder');
  assert.throws(()=>purchase.prepare(1),/storage unavailable/);
});
