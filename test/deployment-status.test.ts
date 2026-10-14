import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deploymentStatus} from '../src/lib/deploymentStatus';

test('deployment metadata distinguishes web and node revisions without publishing upstream internals',async()=>{
 const web='a'.repeat(40),node='b'.repeat(40);
 const output=await deploymentStatus(web,'http://127.0.0.1:3400/',async(url,options)=>{
  assert.equal(url,'http://127.0.0.1:3400/healthz');assert.equal(options?.redirect,'error');
  assert.deepEqual(options?.headers,{accept:'application/json'});
  return Response.json({ok:true,commit:node,address:'private-node-address',config:{secret:'private-setting'}});
 });
 assert.deepEqual(output,{service:'ainize',web:{status:'running',revision:web},node:{status:'running',revision:node}});
 assert.ok(!JSON.stringify(output).includes('private'));
});
test('unstamped or unavailable node builds cannot masquerade as a known deployed revision',async()=>{
 const unknown=await deploymentStatus('unknown','http://private-node',async()=>Response.json({ok:true}));
 assert.equal(unknown.web.revision,null);assert.equal(unknown.node.status,'unknown_revision');assert.equal(unknown.node.revision,null);
 const unavailable=await deploymentStatus('a'.repeat(40),'http://private-node',async()=>{throw Error('private-node password=private');});
 assert.deepEqual(unavailable.node,{status:'unavailable',revision:null});
 assert.ok(!JSON.stringify(unavailable).includes('private'));
});
