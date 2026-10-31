import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOrgInvite } from '../src/api/organizations';
import { createdOrgInvite, listedOrgInvite, openOrgInvite, confirmedInviteRevocation } from '../src/lib/orgInvites';

const now = 1_800_000_000_000;
const invite = { id: `inv_${'a'.repeat(64)}`, token: 'abcdef-fixture-bearer', token_prefix: 'abcdef', role: 'write' as const,
  email: 'person@example.com', created_by: 'sso:owner', created_at: now, expires_at: now + 24 * 3600_000, used_by: null,
  url: 'https://ainize.example/org/join/abcdef-fixture-bearer' };
const expected = { role: 'write' as const, email: 'PERSON@EXAMPLE.COM', ttlHours: 24 };

test('creation confirms the selected role, email, expiry and exact join token before showing a link', () => {
  assert.deepEqual(createdOrgInvite({ invite }, expected, now), invite);
  for (const patch of [{ role: 'admin' }, { email: 'other@example.com' }, { expires_at: now + 1 }, { used_by: 'sso:used' }, { id: null },
    { url: 'https://ainize.example/org/join/another-token' }, { url: 'javascript:alert(1)' }, { token_prefix: 'other' }, { role: 'unknown' }]) {
    assert.equal(createdOrgInvite({ invite: { ...invite, ...patch } }, expected, now), null);
  }
  assert.equal(createdOrgInvite({ invite }, expected, invite.expires_at), null);
});

test('a used, revoked, expired or changed invitation cannot keep its one-time link copyable', () => {
  const listed = { ...invite, token: null, url: null };
  assert.equal(listedOrgInvite(invite, [listed], now), true);
  for (const rows of [[], [{ ...listed, id: `inv_${'b'.repeat(64)}` }], [{ ...listed, used_by: 'sso:used' }], [{ ...listed, role: 'read' as const }], [{ ...listed, email: null }]]) {
    assert.equal(listedOrgInvite(invite, rows, now), false);
  }
  assert.equal(listedOrgInvite(invite, [listed], invite.expires_at), false);
  assert.equal(openOrgInvite({ ...listed, expires_at: null }, now), false);
});

test('short labels cannot be revocation ids and acknowledgements must match the exact management id', () => {
  assert.equal(parseOrgInvite({ ...invite, id: invite.token_prefix }), null);
  assert.equal(parseOrgInvite({ ...invite, role: 'unknown' }), null);
  assert.equal(parseOrgInvite({ ...invite, id: undefined })?.id, null, 'older list rows remain readable without exposing a broken revoke action');
  assert.equal(confirmedInviteRevocation({ revoked: true }, invite.id), false);
  assert.equal(confirmedInviteRevocation({ revoked: true, id: 'other' }, invite.id), false);
  assert.equal(confirmedInviteRevocation({ revoked: true, id: invite.id }, invite.id), true);
});

test('the revoke request sends a management id and refreshes the subscribed invitation list', async () => {
  const { configureStore } = await import('@reduxjs/toolkit');
  const { api } = await import('../src/api/api');
  const nativeFetch = globalThis.fetch, NativeRequest = globalThis.Request;
  let revoked = false;
  const requests: string[] = [];
  globalThis.Request = class extends NativeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) { super(typeof input === 'string' ? new URL(input, 'https://fixture.invalid') : input, init); }
  };
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init), url = new URL(req.url);
    assert.equal(url.search, '');
    requests.push(`${req.method} ${url.pathname}`);
    if (req.method === 'DELETE') {
      assert.equal(url.pathname, `/api/orgs/studio/invites/${invite.id}`);
      revoked = true; return Response.json({ revoked: true, id: invite.id });
    }
    assert.equal(url.pathname, '/api/orgs/studio/invites');
    return Response.json({ invites: revoked ? [] : [{ ...invite, token: null, url: null }] });
  };
  const store = configureStore({ reducer: { [api.reducerPath]: api.reducer }, middleware: gdm => gdm().concat(api.middleware) });
  const scope = { id: 'studio', identity: 'account-a' };
  const subscription = store.dispatch(api.endpoints.orgInvites.initiate(scope));
  try {
    await subscription.unwrap();
    assert.equal(api.endpoints.orgInvites.select({ ...scope, identity: 'account-b' })(store.getState()).data, undefined);
    const result = await store.dispatch(api.endpoints.revokeOrgInvite.initiate({ id: scope.id, token: invite.id })).unwrap();
    assert.equal(confirmedInviteRevocation(result, invite.id), true);
    await Promise.all(store.dispatch(api.util.getRunningQueriesThunk()));
    assert.deepEqual(api.endpoints.orgInvites.select(scope)(store.getState()).data, { invites: [] });
    assert.equal(requests.length, 3);
  } finally {
    subscription.unsubscribe(); store.dispatch(api.util.resetApiState()); globalThis.fetch = nativeFetch; globalThis.Request = NativeRequest;
  }
});
