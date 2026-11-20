import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GET as health } from '../app/healthz/route';
import { GET as ready } from '../app/readyz/route';
const commit = 'abcde'.repeat(8);
test('public probes read the corresponding node endpoint, retain readiness failure and omit private diagnostics', async t => {
  const paths: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: URL) => {
    paths.push(url.pathname);
    const ok = url.pathname === '/healthz';
    return Response.json({ok, commit, checks:{error:'private endpoint'}}, {status:ok ? 200 : 503});
  });
  const live = await health(), readiness = await ready();
  assert.deepEqual(paths, ['/healthz','/readyz']);
  assert.deepEqual(await live.json(), {ok:true,commit});
  assert.deepEqual(await readiness.json(), {ok:false,commit});
  assert.equal(live.status,200);
  assert.equal(readiness.status,503);
  assert.equal(live.headers.get('cache-control'),'no-store');
});
test('HTML or a missing upstream revision cannot produce a successful probe',async t=>{
  const f=t.mock.method(globalThis,'fetch',async()=>new Response('<html></html>'));
  assert.equal((await health()).status,502);
  f.mock.mockImplementation(async()=>Response.json({ok:true,commit:null}));
  assert.equal((await ready()).status,502);
});
