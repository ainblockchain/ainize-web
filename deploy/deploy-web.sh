#!/usr/bin/env bash
# Deploy a committed ref; --here is for local staging only.
set -euo pipefail
ARG="${1:-main}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="$(git -C "$HERE" remote get-url origin)"
ROOT="${AINIZE_WEB_ROOT:-$HOME/ainize-web-releases}"
RELEASES="$ROOT/releases"
SERVE="$ROOT/current"
NODE_BIN="${NODE_BIN:-$HOME/.local/node/bin}"
PORT="${AINIZE_WEB_PORT:-3900}"
VERIFY_URL="${AINIZE_WEB_VERIFY_URL-https://ainize.ai/}"
export PATH="$NODE_BIN:$PATH"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

if [ "$ARG" = --here ]; then
  REF='(working tree)'
  SHA="$(git -C "$HERE" rev-parse HEAD)"
  DIRTY=false
  [ -z "$(git -C "$HERE" status --porcelain)" ] || DIRTY=true
  mkdir -p "$WORK/src"
  tar -C "$HERE" --exclude=node_modules --exclude=dist --exclude=.next --exclude=.git -cf - . | tar -C "$WORK/src" -xf -
else
  REF="$ARG"
  DIRTY=false
  git clone --quiet "$REPO" "$WORK/src"
  git -C "$WORK/src" checkout --quiet "$REF"
  SHA="$(git -C "$WORK/src" rev-parse HEAD)"
fi
cd "$WORK/src"
npm ci --no-audit --no-fund
npm run gen:check
npm run typecheck
npm test
npm run build

DEST="$RELEASES/$(date -u +%Y%m%dT%H%M%SZ)-${SHA:0:12}"
[ "$DIRTY" = false ] || DEST="$DEST-dirty"
mkdir -p "$DEST/.next"
cp -r .next/standalone/. "$DEST/"
cp -r .next/static "$DEST/.next/static"
cp -r public "$DEST/public"
printf '%s\n' "$SHA" > "$DEST/.git-sha"
node -e 'require("fs").writeFileSync(process.argv[1], JSON.stringify({ref:process.argv[2],sha:process.argv[3],dirty:process.argv[4]==="true",built_at:new Date().toISOString(),repo:process.argv[5]},null,2))' "$DEST/build-info.json" "$REF" "$SHA" "$DIRTY" "$REPO"

restart_app() {
  if systemctl --user is-enabled ainize-web.service >/dev/null 2>&1; then
    systemctl --user restart ainize-web.service
  else
    local old_pid
    old_pid="$(ss -ltnp 2>/dev/null | grep ":$PORT " | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2 || true)"
    if [ -n "$old_pid" ]; then
      kill "$old_pid"
      for _ in $(seq 1 30); do
        kill -0 "$old_pid" 2>/dev/null || break
        sleep 1
      done
      if kill -0 "$old_pid" 2>/dev/null; then echo "Previous server did not stop" >&2; return 1; fi
    fi
    setsid env AINIZE_NODE_URL="${AINIZE_NODE_URL:-http://127.0.0.1:3400}" PORT="$PORT" HOSTNAME=127.0.0.1 NODE_ENV=production \
      "$NODE_BIN/node" "$SERVE/server.js" < /dev/null > "$ROOT/ainize-web.log" 2>&1 &
    disown 2>/dev/null || true
  fi
}
wait_ready() {
  for _ in $(seq 1 30); do
    if curl -fsS --max-time 2 "http://127.0.0.1:$PORT/" >/dev/null; then return 0; fi
    sleep 1
  done
  return 1
}
PREVIOUS="$(readlink -f "$SERVE" 2>/dev/null || true)"
rollback() {
  trap - ERR
  echo "Deployment failed; restoring $PREVIOUS" >&2
  if [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ]; then
    ln -sfn "$PREVIOUS" "$SERVE.new"
    mv -Tf "$SERVE.new" "$SERVE"
    restart_app && wait_ready || echo 'Rollback needs attention; inspect the process log.' >&2
  fi
  exit 1
}
trap rollback ERR
ln -sfn "$DEST" "$SERVE.new"
mv -Tf "$SERVE.new" "$SERVE"
restart_app
wait_ready
if [ -n "$VERIFY_URL" ]; then
  [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$VERIFY_URL")" = 200 ]
fi
trap - ERR

mapfile -t OLD_RELEASES < <(ls -1dt "$RELEASES"/*/ 2>/dev/null | tail -n +6)
for old in "${OLD_RELEASES[@]}"; do
  [ "${old%/}" = "$DEST" ] || [ "${old%/}" = "$PREVIOUS" ] || rm -rf -- "$old"
done
printf 'Deployed %s\nRelease: %s\nPrevious: %s\n' "$SHA" "$DEST" "$PREVIOUS"
