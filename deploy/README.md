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

### Google sign-in

Create an OAuth client (type *Web application*) in Google Cloud Console and register
`https://ainize.ai/api/auth/google/callback` (plus `http://localhost:3000/api/auth/google/callback` for `next dev`)
as an authorized redirect URI. Put the three secrets in `~/ainize-web-releases/google-oauth.env` (mode 600), which
the unit loads; in manual process mode, export them before running the deploy script. A Google session belongs to
this app only — the node does not see it, so it signs a person in but grants no wallet or owner permission.

## Rollback

Point `current` at a previous release and restart `ainize-web.service`. In manual mode,
stop the listening web process and start the previous release's `server.js` with the same
port and node URL. Verify both the loopback URL and domain before considering rollback complete.
