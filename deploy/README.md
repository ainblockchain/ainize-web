# Deploying ainize.ai

Nginx terminates TLS and forwards the domain to a standalone Next.js server on port 3900.
The app proxies node APIs to `AINIZE_NODE_URL` (production: `http://127.0.0.1:3400`).
The node and web app are separate processes.

```bash
deploy/deploy-web.sh main
# or a pushed branch, tag or commit:
deploy/deploy-web.sh <ref>
```

The script installs from the lockfile, checks generated docs, runs type checks and tests,
then builds. Any failure stops deployment. It writes the source commit to `build-info.json`,
flips `~/ainize-web-releases/current`, restarts the server, and checks loopback and the domain.
If activation fails, it restores and restarts the previous release. It keeps five recent
releases plus the active and previous releases.

`--here` copies the working tree for staging. Untracked or modified files mark the release dirty.
Use committed refs for production.

## Host setup

Install Node 24+, Git, Nginx and a TLS certificate for your domain. Use the Nginx template
in `deploy/nginx/ainize.ai.conf`, adjusting the domain and certificate paths.

```bash
mkdir -p ~/.config/systemd/user
cp deploy/ainize-web.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now ainize-web
```

Enable user lingering if the service must survive logout. Configure `AINIZE_NODE_URL` in the unit.
When the unit is absent, the deployment script starts a detached process and writes
`~/ainize-web-releases/ainize-web.log`.

## Configuration

| Variable | Default |
|---|---|
| `AINIZE_WEB_ROOT` | `~/ainize-web-releases` |
| `AINIZE_WEB_PORT` | `3900` (manual process mode) |
| `AINIZE_NODE_URL` | `http://127.0.0.1:3400` (manual process mode) |
| `AINIZE_WEB_VERIFY_URL` | `https://ainize.ai/`; empty disables the public-domain check for staging |
| `TMPDIR` | System temporary directory; choose a filesystem with build space |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Unset; Google sign-in is offered only when both are set together with `AINIZE_WEB_SESSION_SECRET` |
| `AINIZE_WEB_SESSION_SECRET` | Unset; signs the Google session cookie (`openssl rand -base64 32`). Changing it signs everyone out of Google |
| `GOOGLE_OAUTH_REDIRECT_URI` | Derived from the request (`https://<host>/api/auth/google/callback`); set it when a proxy rewrites `Host` |
| `AINIZE_SITE_ASSERTION_SECRET` | Unset; the secret shared with the node's `<AINIZE_HOME>/site-assertion.secret` (≥ 32 chars). Vouches for Google accounts on `/api/keys`, and signs this app's own calls to the node for AIN sign-in |
| `AIN_SSO_ISSUER` / `AIN_SSO_CLIENT_ID` / `AIN_SSO_CLIENT_SECRET` | Unset; "Continue with AIN" is offered only when all three are set **and** `AINIZE_SITE_ASSERTION_SECRET` is (see below) |
| `AIN_SSO_REDIRECT_URI` | Derived from the request (`https://<host>/api/auth/sso/callback`); set it when a proxy rewrites `Host` |
| `LEGACY_LOGIN` | `true` (default): Google sign-in as before. `unlinked_only`: only Google accounts not connected to an AIN account. `false`: Google sign-in off. Anything else counts as `false` |
| `AIN_SSO_SILENT_LOGIN` | On wherever AIN sign-in is. `false` turns off only the automatic sign-in (below); the AIN button stays |

### Google sign-in

Create an OAuth client (type *Web application*) in Google Cloud Console and register
`https://ainize.ai/api/auth/google/callback` (plus `http://localhost:3000/api/auth/google/callback` for `next dev`)
as an authorized redirect URI. Put the three secrets in `~/ainize-web-releases/google-oauth.env` (mode 600), which
the unit loads; in manual process mode, export them before running the deploy script. A Google session belongs to
this app only — the node does not see it, so it signs a person in but grants no wallet or owner permission.

### AIN sign-in (AIN SSO)

"Continue with AIN" (AIN 계정으로 계속) is an alternative to the Google button, not a replacement, and it is off until
configured. This app is the OpenID Connect client (code flow with PKCE, `state` and `nonce`; the ID token is verified
against AIN SSO's keys); the session itself is the node's, so AIN SSO can end it (back-channel logout, suspension).
The node side — adapter, sessions, what suspension revokes — is described in ainize-node `docs/ain-sso.md`; configure
the node first (`AIN_SSO_ISSUER`, `AIN_SSO_CLIENT_ID`, `AIN_SSO_ADAPTER_URL`).

1. Register the ainize client at AIN SSO: redirect URI `https://ainize.ai/api/auth/sso/callback`, back-channel logout
   URI `https://ainize.ai/api/auth/sso/backchannel-logout`, adapter URL `https://ainize.ai/api/sso/adapter`,
   scopes `openid profile email org`, `client_secret_basic`.
2. Add `AIN_SSO_ISSUER`, `AIN_SSO_CLIENT_ID` and `AIN_SSO_CLIENT_SECRET` to the environment file the unit loads
   (`~/ainize-web-releases/google-oauth.env`, mode 600) and restart. `AINIZE_SITE_ASSERTION_SECRET` must already be
   there.
3. Move `LEGACY_LOGIN` from `true` to `unlinked_only` to `false` following the AIN SSO rollout runbook
   (`docs/runbooks/migration-rollback.md` in ainetwork-ai/sso). Wallet sign-in is never affected.

Accounts are linked by AIN's verified subject, never by email. A person signing in with AIN for the first time, while
Google sign-in is still allowed, may connect their existing ainize.ai Google account by being signed in to it in the
same browser; the link is reported to AIN SSO. Whatever `LEGACY_LOGIN` says, a Google session is refused once AIN SSO
has suspended the account — the node keeps that state, and this app asks it whenever `AINIZE_SITE_ASSERTION_SECRET`
is set, including after AIN sign-in is switched off again.

Rollback: remove the three `AIN_SSO_*` variables and restart. The button disappears; suspensions still hold.

### Automatic sign-in, sign-up and sign-out

With AIN sign-in configured, a browser that is signed in to AIN elsewhere is signed in here without a click
(silent SSO, `src/lib/silentSso.ts`, `src/lib/silentSignIn.ts`, `middleware.ts`):

- A page request (GET/HEAD) from a browser with no session here — no `ainize_session`, no Google session, no sign-in
  under way — is answered with one redirect to AIN SSO with `prompt=none`. With an AIN session the ordinary sign-in
  follows and the person lands on the page they asked for; without one AIN SSO answers `login_required` and they land
  on it anonymous, with no error. An automatic sign-in never stops anyone to ask about connecting an old account
  (that stays with the "Continue with AIN" button); a new AIN account gets a fresh ainize account at once.
- Left alone: `/api`, `/agents`, `/x402`, `/p2p`, `/v1`, `/_next`, `/static`, `/.well-known`, file-like paths,
  `/signing`; other methods; crawlers, link unfurlers, monitors, headless and command-line clients (by User-Agent —
  search engines see the landing exactly as before); prefetches and prerenders (`Sec-Purpose`, `Purpose`), fetches and
  iframes (`Sec-Fetch-*`), Next's RSC requests.
- At most once per 30 minutes per browser: `ain_sso_checked` (HttpOnly, SameSite=Lax, Secure) is set on the response
  that leaves for AIN SSO. A client that keeps no cookies comes back with `?ain_sso_checked=1`, which also counts.
- A Google cookie that can never count again — `LEGACY_LOGIN=false`, or signed with a rotated
  `AINIZE_WEB_SESSION_SECRET` — is cleared by the page's own session check (`/api/auth/google/session`), so it does
  not keep the automatic sign-in away from that browser until it expires.
- It never puts AIN SSO's problems in front of the site: when AIN SSO has not answered its discovery document within
  the last minute, or when most silent sign-ins of the last ten minutes left and never came back (an error page at
  AIN SSO), visitors go straight to their page (paused for ten minutes, logged once). `AIN_SSO_SILENT_LOGIN=false`
  switches it off by hand. The pause counts clients, not requests — at least 20 addresses (IPv6 by /64, from the
  `X-Real-IP` nginx sets; keep that header in the proxy config), fewer than one in five of them back — so one client
  that requests pages and never follows the redirect cannot switch it off for everybody.

"AIN 계정으로 가입 / Create an AIN account" under the AIN button opens AIN SSO's sign-up page (`prompt=create`). With
`LEGACY_LOGIN=false` the Google button goes through AIN SSO straight to Google (`ain_idp=google`) instead of this
app's own Google sign-in.

A Google sign-in here (the legacy one) is reported to AIN SSO right after it succeeds —
`POST {issuer}/api/upstream/app-attest {legacyUserId: "google:<sub>", googleSub, legacyLoginAt}`, client_secret_basic,
not waited for, nothing but the status logged — so AIN SSO links that ainize account to the AIN account with the same
Google identity and pushes `legacyUserId` to the node's adapter (ainize-node `docs/ain-sso.md` §3). No email is sent.

"Log out" marks the browser checked, so the automatic sign-in does not undo it; for an AIN session the page then goes
to AIN SSO's sign-out (`/api/auth/sso/logout` → `end_session_endpoint`, RP-initiated logout), which asks whether to
sign out of AIN in this browser too and returns to `https://ainize.ai/` (registered as the client's
`post_logout_redirect_uri`). A session cookie the node no longer knows (back-channel logout, suspension) is cleared the
next time the page asks `/api/auth/me`, so automatic sign-in can work again.

## Rollback

Point `current` at a previous release and restart `ainize-web.service`. In manual mode,
stop the listening web process and start the previous release's `server.js` with the same
port and node URL. Verify both the loopback URL and domain before considering rollback complete.
