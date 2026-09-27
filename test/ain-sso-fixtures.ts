/**
 * Test doubles for AIN SSO sign-in (not a test file itself — `npm test` runs test/*.test.ts):
 *
 * - a small OpenID provider: discovery, JWKS, and a token endpoint that holds the client to client_secret_basic,
 *   the redirect URI and PKCE S256, and signs RS256 ID tokens — which a test can spoil one claim at a time;
 *   plus the `/api/upstream/app-proof` endpoint, recorded;
 * - a stand-in node that answers the two site calls only when they carry a valid `x-ainize-site-call`.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { signSiteCall } from '../src/lib/nodeCall';

const readBody = (req: IncomingMessage) => new Promise<string>((resolve) => {
  const chunks: Buffer[] = [];
  req.on('data', (c: Buffer) => chunks.push(c));
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
});
const listen = async (server: Server) => { await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r())); return `http://127.0.0.1:${(server.address() as { port: number }).port}`; };

export interface IssuedCode { challenge: string; nonce: string; redirectUri: string; sub: string; claims: Record<string, unknown> }

export async function startIssuer(clientId: string, clientSecret: string) {
  const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });
  const { privateKey: foreign } = await generateKeyPair('RS256', { extractable: true });
  const kid = `kid_${randomUUID().slice(0, 8)}`;
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' };
  const codes = new Map<string, IssuedCode>();
  const appProofs: { authorization: string | undefined; body: unknown }[] = [];
  const tokenRequests: URLSearchParams[] = [];
  const state = { spoil: null as null | ((claims: Record<string, unknown>) => Record<string, unknown>), signWithForeign: false };
  let issuer = '';

  const server = createServer(async (req, res) => {
    const json = (status: number, body: unknown) => { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body)); };
    if (req.url === '/.well-known/openid-configuration') {
      return json(200, {
        issuer, authorization_endpoint: `${issuer}/oidc/auth`, token_endpoint: `${issuer}/oidc/token`, jwks_uri: `${issuer}/oidc/jwks`,
        response_types_supported: ['code'], subject_types_supported: ['public'], id_token_signing_alg_values_supported: ['RS256'],
        token_endpoint_auth_methods_supported: ['client_secret_basic'], code_challenge_methods_supported: ['S256'],
        scopes_supported: ['openid', 'profile', 'email', 'org', 'offline_access'],
      });
    }
    if (req.url === '/oidc/jwks') return json(200, { keys: [jwk] });
    if (req.url === '/oidc/token' && req.method === 'POST') {
      const form = new URLSearchParams(await readBody(req));
      tokenRequests.push(form);
      const basic = Buffer.from((req.headers.authorization ?? '').replace(/^Basic /, ''), 'base64').toString('utf8');
      const [id, secret] = basic.split(':').map((s) => decodeURIComponent(s));
      if (id !== clientId || secret !== clientSecret) return json(401, { error: 'invalid_client' });
      const code = codes.get(form.get('code') ?? '');
      codes.delete(form.get('code') ?? '');
      if (!code) return json(400, { error: 'invalid_grant' });
      if (form.get('redirect_uri') !== code.redirectUri) return json(400, { error: 'invalid_grant', error_description: 'redirect_uri' });
      const challenge = createHash('sha256').update(form.get('code_verifier') ?? '').digest('base64url');
      if (challenge !== code.challenge) return json(400, { error: 'invalid_grant', error_description: 'PKCE' });
      const now = Math.floor(Date.now() / 1000);
      let claims: Record<string, unknown> = { iss: issuer, aud: clientId, sub: code.sub, nonce: code.nonce, iat: now, exp: now + 3600, auth_time: now, ...code.claims };
      if (state.spoil) claims = state.spoil(claims);
      const idToken = await new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid, typ: 'JWT' }).sign(state.signWithForeign ? foreign : privateKey);
      return json(200, { access_token: randomBytes(16).toString('hex'), token_type: 'Bearer', expires_in: 600, id_token: idToken, scope: 'openid profile email org' });
    }
    if (req.url === '/api/upstream/app-proof' && req.method === 'POST') {
      appProofs.push({ authorization: req.headers.authorization, body: JSON.parse(await readBody(req)) });
      return json(201, { mapping: { status: 'linked' }, created: true });
    }
    json(404, { error: 'not_found' });
  });
  issuer = await listen(server);

  return {
    get issuer() { return issuer; },
    codes, appProofs, tokenRequests, state,
    /**
     * What AIN SSO does between the redirect and the callback: read the app's authorization request, remember
     * the challenge, nonce and redirect URI with a fresh code, and send the browser back with it.
     */
    authorize(authorizeUrl: string, sub: string, claims: Record<string, unknown> = {}): string {
      const u = new URL(authorizeUrl);
      const code = randomBytes(16).toString('hex');
      codes.set(code, { challenge: u.searchParams.get('code_challenge')!, nonce: u.searchParams.get('nonce')!, redirectUri: u.searchParams.get('redirect_uri')!, sub, claims });
      const back = new URL(u.searchParams.get('redirect_uri')!);
      back.searchParams.set('code', code);
      back.searchParams.set('state', u.searchParams.get('state')!);
      return back.href;
    },
    stop: () => new Promise<void>((r) => server.close(() => r())),
  };
}

export type SiteCallRecord = { path: string; body: Record<string, unknown>; signed: boolean };

/** A node that checks the site's signature and answers what the test says. */
export async function startFakeNode(secret: string) {
  const calls: SiteCallRecord[] = [];
  const replies = new Map<string, (body: Record<string, unknown>) => { status: number; body: unknown }>();
  const server = createServer(async (req, res) => {
    const raw = await readBody(req);
    const header = String(req.headers['x-ainize-site-call'] ?? '');
    const m = /^(\d+)\.([0-9a-f]{32})\.([0-9a-f]{64})$/.exec(header);
    const signed = !!m && signSiteCall(secret, req.method ?? 'POST', req.url ?? '', Number(m[1]), raw, m[2]) === header && Math.abs(Date.now() / 1000 - Number(m[1])) <= 60;
    const body = raw ? JSON.parse(raw) as Record<string, unknown> : {};
    calls.push({ path: req.url ?? '', body, signed });
    res.setHeader('content-type', 'application/json');
    if (!signed) { res.statusCode = 401; res.end(JSON.stringify({ error: 'not_the_site' })); return; }
    const reply = replies.get(req.url ?? '');
    const out = reply ? reply(body) : { status: 404, body: { error: 'not found' } };
    res.statusCode = out.status;
    res.end(JSON.stringify(out.body));
  });
  const url = await listen(server);
  return { url, calls, replies, stop: () => new Promise<void>((r) => server.close(() => r())) };
}
