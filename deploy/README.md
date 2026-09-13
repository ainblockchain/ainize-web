# Deploying ainize.ai

The site is a static build. nginx serves it and proxies `/api`, `/x402` and `/p2p` to a node. A deploy is one
symlink flip, so it is atomic and the site stays up while the node is down.

```bash
deploy/deploy-web.sh              # deploy origin/main — this is what a release is
deploy/deploy-web.sh v1.2.0       # …or any ref on the remote
deploy/deploy-web.sh --here       # deploy this working tree, uncommitted changes included
```

`--here` is for seeing something on the real domain before you commit it. The release directory is suffixed
`-dirty` and `build-info.json` records `"dirty": true`, so nobody has to guess later which of two builds is
live. Do not leave a dirty release serving: re-run without it once the work is pushed.

## What a deploy does

1. Clones the ref into a temp directory (or copies this tree for `--here`).
2. `npm install && npm run build`. The build typechecks first, so a tree that does not compile never reaches
   the releases directory, let alone the live one.
3. Runs the tests and prints the result. A failure does not block the deploy — some tests assert things about
   the registry and the docs that fail for reasons outside this tree — but a deploy is never silent about it.
4. Copies `dist/` to `~/ainize-web-releases/releases/<UTC timestamp>-<sha>`, writes `.git-sha` and
   `build-info.json` beside it.
5. Flips `~/ainize-web-releases/current` to it with one `mv -T`. One syscall: nobody is served half a build.
6. Deletes all but the five most recent releases.

## Rollback

```bash
ls -1dt ~/ainize-web-releases/releases/*/ | head           # what is available
ln -sfn ~/ainize-web-releases/releases/<one of them> ~/ainize-web-releases/current
```

No build, no restart, no downtime. Every release carries the sha it came from, so a rollback target is
identifiable rather than "the one from Tuesday".

## First-time setup on a host

```bash
sudo cp deploy/nginx/ainize.ai.conf /etc/nginx/sites-available/ainize.ai
sudo ln -s /etc/nginx/sites-available/ainize.ai /etc/nginx/sites-enabled/ainize.ai
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d ainize.ai -d www.ainize.ai         # rewrites the file with the TLS block
```

The node behind it is a separate install (`~/.ainize-web`, port 3400) that answers only the API. It is
deliberately not the node you develop against: a restart there must not be an outage here.

## Two things that were learned the hard way

**The release path must not contain a dotted directory.** `res.sendFile` defaults to `dotfiles: 'ignore'` and
applies it to every *segment* of the path, so a release under `~/.ainize-web/...` serves every asset with 200
and answers every SPA route with 404 — `express.static` opens what it resolved, `sendFile` walks the path.
Measured, not guessed: the identical directory at a dot-free path served `/` with 200.

**The input must be a ref, not a disk.** The site once served a build of a local working tree, because the
node resolved its assets as `<cli>/../../web/dist` — whatever happened to be in that directory was what the
public saw. That tree had drifted from the published repository and nothing said so. A deployment whose input
is "whatever is on this disk" cannot be reproduced, rolled back or checked, which is why the default here is
a git ref and why `--here` has to announce itself.
