/**
 * Which organization an API key is for — the question the key form has to ask before the node does.
 *
 * `POST /api/keys` wants an `org_id` (one of the organizations the node counts the person a member of, or `null`
 * for a personal key) whenever the person belongs to any. The form used to offer the choice only from the
 * organizations the ID token named, so a person whose token named none while the node knew two saw no picker,
 * sent no `org_id`, and was refused: "say which organization this key is for (org_id: one of …)". These pin the
 * form to the node's own answer about membership (`useShareableOrgs`), in the id the key route accepts.
 *
 *   node --test --import tsx test/api-keys-scope.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { defaultKeyScope, keyScopeOptions, type OrgOption } from '../src/api/sharedAgents';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const myPage = readFileSync(join(root, 'src/screens/MyPage.tsx'), 'utf8');

const comcom: OrgOption = { id: 'comcom', slug: 'comcom', name: 'ComCom', aliases: ['org_9jrn9mc8pp65wj29d5jtx2ss7r'] };
const sysmate: OrgOption = { id: 'org_32jrhdnksppj581emg2b9ejj9g', slug: 'sysmate', name: '시스메이트' };

test('an ainize organization is offered by the AIN organization it links — the id the key route accepts', () => {
  assert.deepEqual(keyScopeOptions([comcom]), [{ org_id: 'org_9jrn9mc8pp65wj29d5jtx2ss7r', name: 'ComCom' }]);
});

test('an AIN organization the token names is offered by its own id', () => {
  assert.deepEqual(keyScopeOptions([sysmate]), [{ org_id: 'org_32jrhdnksppj581emg2b9ejj9g', name: '시스메이트' }]);
});

test('an ainize organization that links no AIN organization is still offered, by its ainize id', () => {
  assert.deepEqual(keyScopeOptions([{ id: 'solo', slug: 'solo', name: 'Solo' }]), [{ org_id: 'solo', name: 'Solo' }]);
});

test('the same organization reached twice is offered once', () => {
  const twice = keyScopeOptions([comcom, { id: 'org_9jrn9mc8pp65wj29d5jtx2ss7r', slug: 'comcom', name: 'ComCom (AIN)' }]);
  assert.equal(twice.length, 1);
});

test('nothing to choose from when the node and the token both name no organization', () => {
  assert.deepEqual(keyScopeOptions(null), []);
  assert.deepEqual(keyScopeOptions([]), []);
});

test('the default is the organization signed in for, else the first, else personal', () => {
  const options = keyScopeOptions([comcom, sysmate]);
  assert.equal(defaultKeyScope(options, 'org_32jrhdnksppj581emg2b9ejj9g'), 'org_32jrhdnksppj581emg2b9ejj9g');
  assert.equal(defaultKeyScope(options, null), 'org_9jrn9mc8pp65wj29d5jtx2ss7r');
  assert.equal(defaultKeyScope(options, 'org_elsewhere'), 'org_9jrn9mc8pp65wj29d5jtx2ss7r');
  assert.equal(defaultKeyScope([], 'org_32jrhdnksppj581emg2b9ejj9g'), null);
});

test('the form asks from what the node says, not only from what the ID token named', () => {
  assert.ok(myPage.includes('useShareableOrgs()'), 'the picker must read membership from the node (useShareableOrgs)');
  assert.ok(myPage.includes('keyScopeOptions('), 'options must be in the id the key route accepts');
  assert.ok(!/\{sso && orgs\.length > 0 &&/.test(myPage), 'gating the picker on the ID token hides the choice the node then insists on');
  assert.ok(/\{keyOrgs\.length > 0 && \(/.test(myPage), 'the picker shows whenever there is an organization to choose');
});

test('an org_id is sent whenever there was something to choose — null means personal, never silence', () => {
  // `scope` is `undefined` (omitted from the request) only when `keyOrgs` is empty; with options it is an id or null.
  assert.ok(/keyOrgs\.length \? defaultKeyScope\(/.test(myPage), 'with organizations to choose, the default scope must be one of them');
  assert.ok(myPage.includes("...(scope !== undefined ? { org_id: scope } : {})"), 'the request carries org_id (an id or null) unless there was nothing to choose');
});
