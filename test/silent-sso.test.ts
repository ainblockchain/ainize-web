/**
 * Automatic sign-in (silent SSO): middleware.ts and src/lib/silentSso.ts decide, src/lib/silentSignIn.ts and
 * api/auth/sso/callback carry it out; the start route's other doors (`prompt=create`, `idp=google`); and what
 * "Log out" and a dead session cookie do to it. Driven through the middleware and the route
 * handlers against the in-test OpenID provider and stand-in node (test/ain-sso-fixtures.ts).
 *
 *   node --test --import tsx test/silent-sso.test.ts
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { startFakeNode, startIssuer } from './ain-sso-fixtures';
import { middleware } from '../middleware';
import { isBrowserPageNavigation, silentSsoStart } from '../src/lib/silentSso';
import { noteSilentReturn, noteSilentStart, resetSilentSignInGuards, silentSignInPaused } from '../src/lib/silentSignIn';

const CLIENT = 'app_ainize';
const SECRET = 'client-secret-for-tests';
const SITE = 's'.repeat(40);
const SUB = 'acc_0123456789abcdefghijklmnop';
const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const NAV = { 'user-agent': CHROME, accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' };

let I: Awaited<ReturnType<typeof startIssuer>>;
let N: Awaited<ReturnType<typeof startFakeNode>>;
const saved = { ...process.env };

before(async () => {
  I = await startIssuer(CLIENT, SECRET);
  N = await startFakeNode(SITE);
});
after(async () => { await I.stop(); await N.stop(); });
beforeEach(() => {
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
  Object.assign(process.env, {
    AIN_SSO_ISSUER: I.issuer, AIN_SSO_CLIENT_ID: CLIENT, AIN_SSO_CLIENT_SECRET: SECRET, AINIZE_SITE_ASSERTION_SECRET: SITE, AINIZE_NODE_URL: N.url,
    GOOGLE_CLIENT_ID: 'g-client', GOOGLE_CLIENT_SECRET: 'g-secret', AINIZE_WEB_SESSION_SECRET: 'k'.repeat(32),
  });
  delete process.env.LEGACY_LOGIN;
  delete process.env.AIN_SSO_SILENT_LOGIN;
  N.calls.length = 0;
  I.appAttests.length = 0;
  I.state.discoveryDown = false;
  resetSilentSignInGuards();
  N.replies.set('/api/auth/sso/session', (body) => ({ status: 200, body: { status: 'ok', token: `node-token-for-${String(body.sub)}`, principal: `sso:${String(body.sub)}`, expiresAt: Date.now() + 1000, created: true, linked: null } }));
});

/** A request as nginx hands it to this server. */
const page = (path: string, headers: Record<string, string> = NAV, method = 'GET') =>
  new NextRequest(`https://ainize.ai${path}`, { method, headers: { host: 'ainize.ai', 'x-forwarded-proto': 'https', ...headers } });
const withCookie = (cookie: string, headers: Record<string, string> = NAV) => ({ ...headers, cookie });
const cookieOf = (res: Response, name: string): { value: string; attrs: string[] } | undefined => {
  for (const line of res.headers.getSetCookie()) {
    const [pair, ...attrs] = line.split(';').map((s) => s.trim());
    const i = pair!.indexOf('=');
    if (pair!.slice(0, i) === name) return { value: decodeURIComponent(pair!.slice(i + 1)), attrs: attrs.map((a) => a.toLowerCase()) };
  }
  return undefined;
};
const maxAge = (c: { attrs: string[] } | undefined) => Number(c?.attrs.find((a) => a.startsWith('max-age='))?.split('=')[1]);
/** The middleware let the request through to its route, untouched. */
const passed = (res: Response) => res.headers.get('x-middleware-next') === '1' && !res.headers.get('location');

async function silentStart(next = '/models', cookie = '') {
  const { GET } = await import('../app/api/auth/sso/start/route');
  return GET(page(`/api/auth/sso/start?prompt=none&next=${encodeURIComponent(next)}`, cookie ? withCookie(cookie) : NAV));
}
async function callback(query: string, cookie = '') {
  const { GET } = await import('../app/api/auth/sso/callback/route');
  return GET(page(`/api/auth/sso/callback?${query}`, cookie ? withCookie(cookie) : NAV));
}
/** What AIN SSO answers a prompt=none request with when the browser has no AIN session. */
const refusal = (authorizeUrl: string, error = 'login_required') =>
  `error=${error}&state=${encodeURIComponent(new URL(authorizeUrl).searchParams.get('state')!)}&iss=${encodeURIComponent(I.issuer)}`;

// ------------------------------------------------------------------------------------------------ the decision

test('a browser opening a page with no session is handed to the start route with prompt=none and the page as next', () => {
  assert.equal(silentSsoStart(page('/')), '/api/auth/sso/start?prompt=none&next=%2F');
  assert.equal(silentSsoStart(page('/models/Qwen3.8-Flash-Next?tab=api')), `/api/auth/sso/start?prompt=none&next=${encodeURIComponent('/models/Qwen3.8-Flash-Next?tab=api')}`,
    'deep links keep their path and query; a dotted model id is a page, not a file');
  assert.ok(silentSsoStart(page('/', NAV, 'HEAD')), 'HEAD like GET');
  assert.ok(silentSsoStart(page('/', { 'user-agent': CHROME })), 'a browser that sends no fetch metadata');
  assert.ok(silentSsoStart(page('/', { 'user-agent': CHROME, accept: '*/*' })));
});

test('APIs, assets, the sign-in page and every other method are left alone', () => {
  for (const path of ['/api/auth/me', '/api/auth/sso/callback?code=x', '/api/auth/sso/backchannel-logout', '/api/sso/adapter/v1/health', '/agents/abc/.well-known/agent.json',
    '/x402/pay', '/p2p/peers', '/v1/chat/completions', '/_next/static/chunks/main.js', '/static/favicon.png', '/favicon.ico', '/robots.txt', '/sitemap.xml',
    '/.well-known/openid-configuration', '/signing', '/signing?sso=connect', '/docs/cover.png']) {
    assert.equal(silentSsoStart(page(path)), null, path);
  }
  for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) assert.equal(silentSsoStart(page('/', NAV, method)), null, method);
});

test('crawlers, unfurlers, monitors, headless and command-line clients see the page exactly as before', () => {
  for (const ua of [
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36',
    'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)', 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)', 'Twitterbot/1.0', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/129.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.1; +https://openai.com/gptbot)', 'Mozilla/5.0 (compatible; YandexBot/3.0)',
    'Mozilla/5.0+(compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)', 'curl/8.5.0', 'Wget/1.21.4', 'python-requests/2.32.3', 'Go-http-client/2.0', 'node', '',
  ]) assert.equal(silentSsoStart(page('/', { ...NAV, 'user-agent': ua })), null, ua || '(no user agent)');
});

test('prefetches, prerenders, fetches, iframes and non-HTML requests are not navigations', () => {
  const cases: Record<string, string>[] = [
    { 'sec-purpose': 'prefetch' }, { 'sec-purpose': 'prefetch;prerender' }, { purpose: 'prefetch' }, { 'x-moz': 'prefetch' }, { 'x-purpose': 'preview' },
    { rsc: '1' }, { 'next-router-prefetch': '1' }, { 'sec-fetch-mode': 'cors' }, { 'sec-fetch-mode': 'no-cors' }, { 'sec-fetch-dest': 'iframe' },
    { 'sec-fetch-dest': 'empty' }, { accept: 'application/json' }, { authorization: 'Bearer x' }, { upgrade: 'websocket' },
  ];
  for (const extra of cases) assert.equal(isBrowserPageNavigation(page('/', { ...NAV, ...extra })), false, JSON.stringify(extra));
  assert.equal(silentSsoStart(page('/?_rsc=abc')), null);
});

test('a session, a Google session, a sign-in under way or a recent check means no check', () => {
  for (const cookie of ['ainize_session=t', 'ainize_google_session=g.s', 'ainize_sso_flow=f', 'ainize_sso_pending=p', 'ain_sso_checked=1']) {
    assert.equal(silentSsoStart(page('/', withCookie(cookie))), null, cookie);
  }
  assert.ok(silentSsoStart(page('/', withCookie('theme=dark'))), 'other cookies do not count');
  assert.equal(silentSsoStart(page('/models?ain_sso_checked=1')), null, 'the marker of a browser that keeps no cookies');
});

test('off unless AIN sign-in is configured exactly as the routes read it; AIN_SSO_SILENT_LOGIN=false switches only this off', () => {
  process.env.AIN_SSO_SILENT_LOGIN = 'false';
  assert.equal(silentSsoStart(page('/')), null);
  delete process.env.AIN_SSO_SILENT_LOGIN;
  for (const k of ['AIN_SSO_ISSUER', 'AIN_SSO_CLIENT_ID', 'AIN_SSO_CLIENT_SECRET', 'AINIZE_SITE_ASSERTION_SECRET']) {
    assert.equal(silentSsoStart(page('/'), { ...process.env, [k]: '' }), null, `without ${k}`);
  }
  assert.equal(silentSsoStart(page('/'), { ...process.env, AIN_SSO_ISSUER: 'http://auth.comcom.ai' }), null, 'an issuer the routes would refuse');
});

// ------------------------------------------------------------------------------------------------ the middleware

test('middleware: the page request itself answers with the one redirect to AIN SSO; everything else passes through', async () => {
  const res = await middleware(page('/teach?x=1'));
  assert.equal(res.status, 302);
  const u = new URL(res.headers.get('location')!);
  assert.equal(u.origin + u.pathname, `${I.issuer}/oidc/auth`, 'straight to AIN SSO, not via another hop here');
  assert.equal(u.searchParams.get('prompt'), 'none');
  assert.equal(u.searchParams.get('redirect_uri'), 'https://ainize.ai/api/auth/sso/callback');
  assert.equal(cookieOf(res, 'ain_sso_checked')?.value, '1');
  assert.ok(cookieOf(res, 'ainize_sso_flow')?.value);
  for (const [path, headers] of [['/api/models', NAV], ['/_next/static/a.js', NAV], ['/', { ...NAV, 'user-agent': 'Googlebot/2.1' }], ['/', withCookie('ain_sso_checked=1')]] as const) {
    assert.ok(passed(await middleware(page(path, headers))), `${path} continues untouched`);
  }
  const www = await middleware(new NextRequest('https://www.ainize.ai/models', { headers: { host: 'www.ainize.ai', ...NAV } }));
  assert.equal(www.status, 308, 'the canonical host comes first');
  assert.equal(www.headers.get('location'), 'https://ainize.ai/models');
});

test('middleware with nothing configured: nothing changes', async () => {
  for (const k of ['AIN_SSO_ISSUER', 'AIN_SSO_CLIENT_ID', 'AIN_SSO_CLIENT_SECRET']) delete process.env[k];
  assert.ok(passed(await middleware(page('/'))));
});

// ------------------------------------------------------------------------------------------------ start

test('start with prompt=none: straight to AIN SSO with prompt=none, and the browser is marked checked on that response', async () => {
  const res = await silentStart('/teach?x=1');
  assert.equal(res.status, 302);
  const u = new URL(res.headers.get('location')!);
  assert.equal(u.origin + u.pathname, `${I.issuer}/oidc/auth`);
  assert.equal(u.searchParams.get('prompt'), 'none');
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
  assert.match(u.searchParams.get('state')!, /^sn\./);
  const checked = cookieOf(res, 'ain_sso_checked')!;
  assert.equal(checked.value, '1');
  assert.equal(maxAge(checked), 1800);
  for (const attr of ['httponly', 'secure', 'samesite=lax', 'path=/']) assert.ok(checked.attrs.includes(attr), attr);
  assert.ok(cookieOf(res, 'ainize_sso_flow')?.value, 'the flow is sealed as for any sign-in');
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('an automatic sign-in that cannot go to AIN SSO goes to the page instead — never to an error', async () => {
  I.state.discoveryDown = true;
  const down = await silentStart('/models');
  assert.equal(down.headers.get('location'), '/models', 'AIN SSO not answering');
  assert.equal(cookieOf(down, 'ain_sso_checked')?.value, '1');
  I.state.discoveryDown = false;
  resetSilentSignInGuards();

  for (const k of ['AIN_SSO_ISSUER', 'AIN_SSO_CLIENT_ID', 'AIN_SSO_CLIENT_SECRET']) delete process.env[k];
  const off = await silentStart('/models');
  assert.equal(off.status, 302, 'not configured: not a 503 in front of a page');
  assert.equal(off.headers.get('location'), '/models');
  const { GET } = await import('../app/api/auth/sso/start/route');
  assert.equal((await GET(page('/api/auth/sso/start'))).status, 503, 'the button\'s own start still says so');
});

test('silent sign-ins that leave and never come back pause the feature (AIN SSO showing an error page to visitors)', async () => {
  const t0 = Date.now();
  for (let i = 0; i < 25; i++) noteSilentStart(`sn.lost${i}`, t0 - 60_000);
  assert.equal(silentSignInPaused(t0), true);
  const res = await silentStart('/');
  assert.equal(res.headers.get('location'), '/', 'paused: straight to the page');
  resetSilentSignInGuards();
  for (let i = 0; i < 25; i++) noteSilentStart(`sn.ok${i}`, t0 - 60_000);
  for (let i = 0; i < 25; i++) noteSilentReturn(`sn.ok${i}`);
  assert.equal(silentSignInPaused(t0), false, 'the ones that came back keep it on');
});

// ------------------------------------------------------------------------------------------------ the other doors of the start route

test('prompt=create asks AIN SSO for its sign-up page; idp=google goes straight to Google (ain_idp); neither is an automatic sign-in', async () => {
  const { GET } = await import('../app/api/auth/sso/start/route');
  const create = await GET(page('/api/auth/sso/start?prompt=create&next=%2Fme'));
  const cu = new URL(create.headers.get('location')!);
  assert.equal(cu.searchParams.get('prompt'), 'create');
  assert.equal(cu.searchParams.get('ain_idp'), null);
  assert.doesNotMatch(cu.searchParams.get('state')!, /^sn\./);
  assert.equal(cookieOf(create, 'ain_sso_checked'), undefined);

  const google = new URL((await GET(page('/api/auth/sso/start?idp=google&next=%2Fme'))).headers.get('location')!);
  assert.equal(google.searchParams.get('ain_idp'), 'google');
  assert.equal(google.searchParams.get('prompt'), null);

  const junk = new URL((await GET(page('/api/auth/sso/start?prompt=login%20consent&idp=github'))).headers.get('location')!);
  assert.equal(junk.searchParams.get('prompt'), null, 'only the prompts this app means');
  assert.equal(junk.searchParams.get('ain_idp'), null);
});

// ------------------------------------------------------------------------------------------------ callback

test('login_required and the other "would need a page" answers return the visitor to their page, anonymous, without an error', async () => {
  for (const error of ['login_required', 'interaction_required', 'consent_required', 'account_selection_required']) {
    const start = await silentStart('/teach?x=1');
    const flow = cookieOf(start, 'ainize_sso_flow')!.value;
    const before = I.tokenRequests.length;
    const res = await callback(refusal(start.headers.get('location')!, error), `ainize_sso_flow=${encodeURIComponent(flow)}; ain_sso_checked=1`);
    assert.equal(res.status, 302, error);
    assert.equal(res.headers.get('location'), '/teach?x=1', error);
    assert.equal(cookieOf(res, 'ainize_session'), undefined, error);
    assert.equal(maxAge(cookieOf(res, 'ainize_sso_flow')), 0, `${error}: the flow is spent`);
    assert.equal(cookieOf(res, 'ain_sso_checked')?.value, '1', `${error}: still checked`);
    assert.equal(I.tokenRequests.length, before, `${error}: nothing was exchanged`);
  }
  assert.equal(N.calls.length, 0, 'the node never heard of it');
});

test('the same answers to a sign-in somebody asked for still show the reason', async () => {
  const { GET } = await import('../app/api/auth/sso/start/route');
  const start = await GET(page('/api/auth/sso/start?next=%2Fmodels'));
  const flow = cookieOf(start, 'ainize_sso_flow')!.value;
  const res = await callback(refusal(start.headers.get('location')!), `ainize_sso_flow=${encodeURIComponent(flow)}`);
  const to = new URL(res.headers.get('location')!);
  assert.equal(to.pathname, '/signing');
  assert.match(to.searchParams.get('sso_error')!, /login_required/);
});

test('the page carried in a silent state is a path on this site, whatever a hand-made callback URL says', async () => {
  for (const evil of ['//evil.example/x', '/\\evil.example', '/\t/evil.example', '/\n/evil.example', 'https://evil.example/']) {
    const state = `sn.${'a'.repeat(43)}.${Buffer.from(evil).toString('base64url')}`;
    const res = await callback(`error=login_required&state=${state}`);
    assert.equal(res.headers.get('location'), '/?ain_sso_checked=1', JSON.stringify(evil));
  }
});

test('a browser that keeps no cookies comes back once, marked, and the marker stops a second trip', async () => {
  const start = await silentStart('/teach?x=1');
  const res = await callback(refusal(start.headers.get('location')!));
  assert.equal(res.headers.get('location'), '/teach?x=1&ain_sso_checked=1', 'the page from the state, with the marker');
  assert.ok(passed(await middleware(page('/teach?x=1&ain_sso_checked=1'))), 'no loop');
  const root = await callback(refusal((await silentStart('/')).headers.get('location')!));
  assert.equal(root.headers.get('location'), '/?ain_sso_checked=1');
});

test('an AIN session signs the person in: the normal sign-in, without the connect question', async () => {
  process.env.LEGACY_LOGIN = 'true';
  const start = await silentStart('/models');
  const flow = cookieOf(start, 'ainize_sso_flow')!.value;
  const back = new URL(I.authorize(start.headers.get('location')!, SUB, { sid: 'sid_9', name: 'Kim', email: 'kim@comcom.ai', email_verified: true }));
  const res = await callback(back.search.slice(1), `ainize_sso_flow=${encodeURIComponent(flow)}; ain_sso_checked=1`);
  assert.equal(res.status, 302);
  assert.equal(new URL(res.headers.get('location')!).pathname, '/models');
  assert.equal(cookieOf(res, 'ainize_session')?.value, `node-token-for-${SUB}`);
  const call = N.calls.find((c) => c.path === '/api/auth/sso/session')!;
  assert.ok(call.signed);
  assert.equal(call.body.sid, 'sid_9', 'keyed by sid like any other AIN session');
  assert.equal(call.body.allowConnect, false, 'an automatic sign-in never stops the visitor with a question');
  assert.equal(I.appAttests.length, 0, 'an SSO sign-in is never attested');
});

test('an automatic sign-in the node refuses (suspended) or that fails verification leaves the visitor anonymous, quietly', async () => {
  N.replies.set('/api/auth/sso/session', () => ({ status: 403, body: { error: 'account_suspended' } }));
  let start = await silentStart('/models');
  let flow = cookieOf(start, 'ainize_sso_flow')!.value;
  let res = await callback(new URL(I.authorize(start.headers.get('location')!, SUB)).search.slice(1), `ainize_sso_flow=${encodeURIComponent(flow)}`);
  assert.equal(res.headers.get('location'), '/models');
  assert.equal(cookieOf(res, 'ainize_session'), undefined);

  I.state.spoil = (c) => ({ ...c, aud: 'someone_else' });
  start = await silentStart('/models');
  flow = cookieOf(start, 'ainize_sso_flow')!.value;
  res = await callback(new URL(I.authorize(start.headers.get('location')!, SUB)).search.slice(1), `ainize_sso_flow=${encodeURIComponent(flow)}`);
  I.state.spoil = null;
  assert.equal(res.headers.get('location'), '/models');
  assert.equal(cookieOf(res, 'ainize_session'), undefined, 'a token that is not ours signs nobody in, silent or not');
});

test('loop protection end to end: page → AIN SSO → back → page, then nothing for 30 minutes', async () => {
  const first = await middleware(page('/models'));
  const checked = cookieOf(first, 'ain_sso_checked')!;
  const flow = cookieOf(first, 'ainize_sso_flow')!;
  const back = await callback(refusal(first.headers.get('location')!), `ainize_sso_flow=${encodeURIComponent(flow.value)}; ain_sso_checked=${checked.value}`);
  assert.equal(back.headers.get('location'), '/models');
  const again = await middleware(page('/models', withCookie(`ain_sso_checked=${cookieOf(back, 'ain_sso_checked')!.value}`)));
  assert.ok(passed(again), 'the second request with the cookie is served as it is');
});

// ------------------------------------------------------------------------------------------------ sign-out

test('Log out marks the browser checked, so the automatic sign-in does not undo it', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).endsWith('/api/auth/logout')) return new Response('{"ok":true}', { headers: { 'content-type': 'application/json', 'set-cookie': 'ainize_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT' } });
    return realFetch(url, init);
  }) as typeof fetch;
  try {
    const { POST } = await import('../app/api/auth/logout/route');
    const res = await POST(page('/api/auth/logout', withCookie('ainize_session=t', { 'content-type': 'application/json' }), 'POST'));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    assert.equal(cookieOf(res, 'ainize_session')?.value, '', 'the node\'s own cookie clearing still arrives');
    const checked = cookieOf(res, 'ain_sso_checked')!;
    assert.equal(checked.value, '1');
    assert.equal(maxAge(checked), 1800);
    assert.ok(checked.attrs.includes('httponly') && checked.attrs.includes('secure'));
  } finally { globalThis.fetch = realFetch; }
});

test('an AIN session continues to AIN SSO\'s sign-out (RP-initiated logout) and comes back to this site', async () => {
  const { GET } = await import('../app/api/auth/sso/logout/route');
  const res = await GET(page('/api/auth/sso/logout', withCookie('ainize_session=t')));
  const u = new URL(res.headers.get('location')!);
  assert.equal(u.origin + u.pathname, `${I.issuer}/oidc/session/end`);
  assert.equal(u.searchParams.get('client_id'), CLIENT);
  assert.equal(u.searchParams.get('post_logout_redirect_uri'), 'https://ainize.ai/');
  assert.equal(cookieOf(res, 'ain_sso_checked')?.value, '1');
  assert.equal(cookieOf(res, 'ainize_session'), undefined, 'a GET anyone can link to signs nobody out; the POST did');
  for (const k of ['AIN_SSO_ISSUER', 'AIN_SSO_CLIENT_ID', 'AIN_SSO_CLIENT_SECRET']) delete process.env[k];
  assert.equal((await GET(page('/api/auth/sso/logout'))).headers.get('location'), '/', 'without AIN SSO: home');
});

test('a session cookie the node no longer knows is cleared, so automatic sign-in can work again', async () => {
  const realFetch = globalThis.fetch;
  let me: { status: number; body: unknown } = { status: 200, body: { signedIn: false, subject: null, sso: null } };
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).endsWith('/api/auth/me')) return Response.json(me.body, { status: me.status });
    return realFetch(url, init);
  }) as typeof fetch;
  try {
    const { GET } = await import('../app/api/auth/me/route');
    const dead = await GET(page('/api/auth/me', withCookie('ainize_session=gone', { accept: 'application/json' })));
    assert.deepEqual(await dead.json(), { signedIn: false, subject: null, sso: null }, 'the body is the node\'s, unchanged');
    assert.equal(maxAge(cookieOf(dead, 'ainize_session')), 0);
    me = { status: 200, body: { signedIn: false, subject: null, sso: { sub: SUB } } };
    assert.equal(cookieOf(await GET(page('/api/auth/me', withCookie('ainize_session=live'))), 'ainize_session'), undefined, 'a live AIN session stays');
    me = { status: 200, body: { signedIn: true, subject: '0xabc', sso: null } };
    assert.equal(cookieOf(await GET(page('/api/auth/me', withCookie('ainize_session=live'))), 'ainize_session'), undefined, 'a wallet session stays');
    me = { status: 200, body: { signedIn: false, subject: null } };
    assert.equal(cookieOf(await GET(page('/api/auth/me', withCookie('ainize_session=x'))), 'ainize_session'), undefined, 'a node that predates AIN sessions is not second-guessed');
    me = { status: 502, body: { error: 'the node is not answering' } };
    assert.equal(cookieOf(await GET(page('/api/auth/me', withCookie('ainize_session=x'))), 'ainize_session'), undefined, 'never on an error');
  } finally { globalThis.fetch = realFetch; }
});
