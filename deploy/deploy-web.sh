#!/usr/bin/env bash
# Deploy ainize.ai. This script lives in the repository it deploys.
#
#   deploy/deploy-web.sh              # deploy origin/main (the default, and what a release should be)
#   deploy/deploy-web.sh v1.2.0       # …or any ref that exists on the remote
#   deploy/deploy-web.sh --here       # deploy THIS working tree, uncommitted changes and all
#
# `--here` is for looking at something on the real domain before committing it. It records the sha it was
# based on plus `dirty: true`, so a release directory always says what it came from and nobody has to guess
# later which of two builds is on the site.
#
# WHY THIS EXISTS. The site was serving a build of a LOCAL working tree — the node resolves its web assets as
# `<cli>/../../web/dist`, so whatever happened to be in that directory is what the public saw. That tree had
# diverged from the published repository, so ainize.ai was showing an older site than the one under version
# control, and nothing anywhere said so. A deployment whose input is "whatever is on this disk" cannot be
# reproduced, rolled back, or checked.
#
# AND THE NODE NO LONGER SERVES THE SITE AT ALL. It can — that is what gives an operator a working UI from a
# single `ainize start`, and it is the right default there. It is the wrong thing in front of a domain: the
# site then dies with the node process, a restart is an outage, and the deployed build is whatever directory
# sits beside the installed CLI. nginx already terminates TLS here, so it is already in the path; it serves
# the files and proxies /api to the node. Verified: with the node stopped, ainize.ai/ still answers 200 and
# only /api/info returns 502.
#
# So the input is a git ref, the output records which ref produced it, and the served directory is replaced
# atomically. Running this twice on the same ref gives the same site.
set -euo pipefail

ARG="${1:-main}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="$(git -C "$HERE" remote get-url origin 2>/dev/null || echo https://github.com/ainblockchain/ainize-web.git)"
# NOT under a dotted directory. `res.sendFile` defaults to `dotfiles: 'ignore'`, and it applies that to every
# SEGMENT of the path it is given — so a release served from ~/.ainize-web/... answers 404 for the SPA
# fallback while express.static happily serves the same files, because static opens what it resolved and
# sendFile walks the path. Symptom: every asset 200, every route 404. Measured, not guessed: the identical
# directory copied to a dot-free path served `/` with 200.
ROOT="${AINIZE_WEB_ROOT:-$HOME/ainize-web-releases}"
RELEASES="$ROOT/releases"
SERVE="$ROOT/current"          # what the node serves — a dot-free path, see the note above
NODE_BIN="${NODE_BIN:-$HOME/.local/node/bin}"
export PATH="$NODE_BIN:$PATH"

say() { printf '  %s\n' "$*"; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

if [ "$ARG" = "--here" ]; then
  # The working tree, verbatim. `git archive` would drop uncommitted edits, which is the one thing this mode
  # exists to include, so the tree is copied — minus the directories that must be rebuilt for this release.
  REF="(working tree)"
  DIRTY=true
  say "deploying the working tree at $HERE"
  mkdir -p "$WORK/src"
  tar -C "$HERE" --exclude=node_modules --exclude=dist --exclude=.git -cf - . | tar -C "$WORK/src" -xf -
  SHA="$(git -C "$HERE" rev-parse HEAD 2>/dev/null || echo unknown)"
  if git -C "$HERE" diff --quiet && git -C "$HERE" diff --cached --quiet; then DIRTY=false; fi
  cd "$WORK/src"
else
  REF="$ARG"
  DIRTY=false
  say "cloning $REPO @ $REF"
  git clone --quiet --depth 1 --branch "$REF" "$REPO" "$WORK/src" 2>/dev/null \
    || git clone --quiet "$REPO" "$WORK/src"
  cd "$WORK/src"
  git checkout --quiet "$REF" 2>/dev/null || true
  SHA="$(git rev-parse HEAD)"
fi
SHORT="${SHA:0:12}"
say "ref $REF -> $SHORT${DIRTY:+ (dirty)}"

say "installing"
npm install --silent --no-audit --no-fund

# The build typechecks first (`tsc --noEmit && vite build`), so a tree that does not compile never reaches the
# releases directory, let alone the live one.
say "building"
npm run build --silent

say "testing"
# A failing test does not block a deploy here — the tests assert things about the registry and the docs that
# can fail for reasons outside this tree — but the result is printed so a deploy is never silent about it.
npm test 2>&1 | tail -3 || say "(tests reported failures — see above)"

DEST="$RELEASES/$(date -u +%Y%m%dT%H%M%SZ)-$SHORT${DIRTY:+-dirty}"
mkdir -p "$DEST"
cp -r dist/. "$DEST/"
printf '%s\n' "$SHA" > "$DEST/.git-sha"
printf '{"ref":"%s","sha":"%s","dirty":%s,"built_at":"%s","repo":"%s"}\n' \
  "$REF" "$SHA" "$DIRTY" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$REPO" > "$DEST/build-info.json"

# Atomic swap: a symlink flip is one syscall, so nobody is ever served half a build.
mkdir -p "$(dirname "$SERVE")"
ln -sfn "$DEST" "$SERVE.new"
mv -Tf "$SERVE.new" "$SERVE"
say "serving $DEST"

# Keep the last five releases so a rollback is `ln -sfn <release> $SERVE`.
ls -1dt "$RELEASES"/*/ 2>/dev/null | tail -n +6 | xargs -r rm -rf

cat <<EOF

deployed
  ref        $REF
  commit     $SHA
  release    $DEST
  served at  $SERVE

nginx serves these files directly (root $SERVE in deploy/nginx/ainize.ai.conf) and proxies only /api, /x402
and /p2p to the node. Nothing to restart: the symlink flip IS the deploy, and the site stays up while the
node is down.

rollback: ln -sfn <older release under $RELEASES> "$SERVE"
releases: ls -1dt $RELEASES/*/ | head
EOF
