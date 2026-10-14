import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AinftTaskSubmission } from '../src/lib/ainftTaskSubmission';

test('a lost acknowledgement retries the stored task rather than executing a second assignment', async () => {
  let keys = 0, executions = 0, calls = 0;
  const submission = new AinftTaskSubmission(() => `key-${++keys}`);
  const tasks = new Map<string, unknown>();
  const send = async (body: { key: string; kind: 'chat' | 'task'; input: string }) => {
    calls++;
    if (!tasks.has(body.key)) { executions++; tasks.set(body.key, { task: { id: `task-${executions}`, ...body } }); }
    if (calls === 1) throw new Error('Connection closed after the server accepted the task');
    return tasks.get(body.key);
  };
  await assert.rejects(submission.submit('agent:alice', 'task', ' Prepare the report ', send, () => true), /Connection closed/);
  const result = await submission.submit('agent:alice', 'task', 'Prepare the report', send, () => true);
  assert.deepEqual(result, { task: { id: 'task-1', key: 'key-1', kind: 'task', input: 'Prepare the report' } });
  assert.equal(executions, 1); assert.equal(keys, 1);
  await submission.submit('agent:alice', 'task', 'Prepare the report', send, () => true);
  assert.equal(executions, 2); // Explicitly sending again after acknowledgement is a new request.
});
test('unknown requests keep separate keys for kind, content and wallet, including edited-back content', async () => {
  let count = 0; const sent: { key: string; kind: string; input: string }[] = [];
  const submission = new AinftTaskSubmission(() => `key-${++count}`);
  const fail = async (body: { key: string; kind: 'chat' | 'task'; input: string }) => { sent.push(body); throw new Error('Unknown outcome'); };
  for (const [identity, kind, input] of [['agent:alice', 'task', 'First'], ['agent:alice', 'task', 'Edited'], ['agent:alice', 'task', 'First'], ['agent:alice', 'chat', 'First'], ['agent:bob', 'task', 'First']] as const) {
    await assert.rejects(submission.submit(identity, kind, input, fail, () => true), /Unknown outcome/);
  }
  assert.deepEqual(sent.map((body) => body.key), ['key-1', 'key-2', 'key-1', 'key-3', 'key-4']);
});
test('malformed acknowledgement retains the key and changed workspace refuses to send', async () => {
  let count = 0; const submission = new AinftTaskSubmission(() => `key-${++count}`);
  await assert.rejects(submission.submit('agent:alice', 'task', 'Work', async () => ({}), () => true), /acknowledgement/);
  await assert.rejects(submission.submit('agent:alice', 'task', 'Work', async () => { throw new Error('Must not send'); }, () => false), /workspace changed/);
  await submission.submit('agent:alice', 'task', 'Work', async (body) => ({ task: { id: 'task', ...body } }), () => true);
  assert.equal(count, 1);
});
test('allowance work restores the same request key after reload without storing the private prompt',async()=>{
  const values=new Map<string,string>();
  const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
  const purchaseId='a'.repeat(64);let submittedKey='';
  const first=new AinftTaskSubmission(()=> 'first-key',storage);
  await assert.rejects(first.submit('agent:holder','task','Private project details',async body=>{submittedKey=body.key;throw new Error('reply lost');},()=>true,purchaseId),/reply lost/);
  assert.equal(JSON.stringify([...values]).includes('Private project details'),false);
  const reloaded=new AinftTaskSubmission(()=> 'must-not-create-key',storage);
  await reloaded.submit('agent:holder','task','Private project details',async body=>{
    assert.equal(body.key,submittedKey);assert.equal(body.purchaseId,purchaseId);
    return {task:{id:'task',...body,benefit:{purchaseId}}};
  },()=>true,purchaseId);
  assert.equal(values.size,0);
});
test('allowance work refuses missing durable storage and acknowledgements for another purchase',async()=>{
  const purchaseId='a'.repeat(64);
  await assert.rejects(new AinftTaskSubmission().submit('agent:holder','task','Work',async()=>{throw new Error('must not send');},()=>true,purchaseId),/Persistent storage/);
  const values=new Map<string,string>(),storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
  const submission=new AinftTaskSubmission(()=> 'key',storage);
  await assert.rejects(submission.submit('agent:holder','task','Work',async body=>({task:{id:'task',...body,benefit:{purchaseId:'b'.repeat(64)}}}),()=>true,purchaseId),/acknowledgement/);
  assert.equal(values.size,1);
});
test('paid task submission pins the purchase policy and rejects an acknowledgement for another version',async()=>{
  const values=new Map<string,string>(),storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
  const submission=new AinftTaskSubmission(()=> 'policy-key',storage),purchaseId='a'.repeat(64);
  await assert.rejects(submission.submit('agent:holder','task','Work',async body=>{assert.equal(body.purchasePolicyVersion,1);return {task:{id:'task',...body,benefit:{purchaseId,policyVersion:2}}};},()=>true,purchaseId,1),/acknowledgement/);
  await submission.submit('agent:holder','task','Work',async body=>({task:{id:'task',...body,benefit:{purchaseId,policyVersion:1}}}),()=>true,purchaseId,1);
  assert.equal(values.size,0);
});
