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

---

# The host this site runs on

Everything above is how a deploy works anywhere. What follows is the state of the machine that serves
ainize.ai today — carried over from the pre-split monorepo, which is the only place it was written down.

One origin, one node behind it. The web app calls its API at `baseUrl: '/'`
(`src/api/api.ts`), so it is same-origin by construction: a CDN serving the assets and pointing
at a node elsewhere does not work without changing that, and changing it would put CORS, cookies and the
signed `x-ngram-auth` header across origins.

### What is already done on this machine

```
~/.ainize-web            a node dedicated to the public site, claimed with its own operator password
  port 3400, host 127.0.0.1     only nginx reaches it; a node on 0.0.0.0 is reachable AROUND the proxy
  publicUrl https://ainize.ai
  roles seller,verifier         NO `serving` role and runtime.api → 127.0.0.1:9 (a dead address)
```

The runtime is pointed at a dead address on purpose. `serving` would put this node in front of the shared
vLLM at `:8002`, where a visitor's live test takes the same runtime lock a benchmark run needs — one public
click could stall a measurement. The site works read-only (catalogue, lineage, docs, verification records)
until that is flipped deliberately.

Verified: `GET /` returns the app and `GET /api/info` the API, both on 127.0.0.1:3400.

### How it was set up, and the one thing that is easy to get wrong

DNS, nginx and TLS are all done — the site answers 200 over HTTPS and the certificate runs to 2026-12-09.
Kept because the DNS step below is the kind of thing that is re-derived wrongly the next time somebody points
a domain at this machine.

1. **DNS.** `ainize.ai` and `www.ainize.ai` both resolve to **101.202.37.20**, which reaches this
   machine.

   **Do not read the public address off an egress lookup.** This host has no public address of its own — its
   interfaces are `192.168.1.41` and loopback — and `api.ipify.org` reports **103.139.119.10**, which is the
   path traffic LEAVES by. Inbound arrives at **101.202.37.20**. They are different, and pointing DNS at the
   egress address would have produced a domain that resolves, answers nothing, and gives certbot nothing to
   validate against.

   How to tell which is right without guessing: ask for a Host this nginx already answers and compare the
   reply to the same request on loopback.
   ```
   curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: finance-demo.ainetwork.ai' http://127.0.0.1/        # 301
   curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: finance-demo.ainetwork.ai' http://<candidate-ip>/    # 301 = it forwards here
   ```
   The TLS certificate a candidate presents is the second check: `openssl s_client -connect <ip>:443` showing
   this machine's existing certificate means the connection terminated here.
2. **nginx** (needs root):
   ```
   sudo cp deploy/nginx/ainize.ai.conf /etc/nginx/sites-available/ainize.ai
   sudo ln -s /etc/nginx/sites-available/ainize.ai /etc/nginx/sites-enabled/ainize.ai
   sudo nginx -t && sudo systemctl reload nginx
   ```
3. **TLS** (after DNS resolves): `sudo certbot --nginx -d ainize.ai -d www.ainize.ai`. Renewal is certbot's
   own timer; the current certificate expires 2026-12-09.
4. **Decide what the catalogue reads from** — see below. This one is still open.

### The open decision: which ledger backs the public catalogue

A node's catalogue is derived from its LEDGER, not from its peers, so this decides whether ainize.ai shows
anything at all.

Measured on this machine today: the `ngram-ain` container is running but **the chain is not serving** — it
has had nothing listening on 8081 since it initialised on 2026-08-31, and node-a's 1,546 records come from
its own store rather than from a live chain. So a fresh node set to `ledger: ain` would sync nothing.

Three options, and the third is the only one that is both safe and honest today:

- **Restart the AIN chain** and give the public node `ledger: ain`. Correct shape, but it changes the ledger
  the benchmark cluster is attached to while a study is unfinished, and the chain has been dead for ten days
  for reasons nobody has established.
- **Proxy ainize.ai to node-a (:3402)**, which already has the catalogue. Expedient and wrong: node-a is a
  throwaway dev cluster whose operator password is a dev credential, and it holds the benchmark's runtime
  access. A public site must not be a door into it.
- **Give the public node its own content.** `ainize seed`, or import the knowledges deliberately, so the site
  shows what it is meant to show and nothing it is not. Self-contained, no dependency on a chain that is
  down, and reversible.

