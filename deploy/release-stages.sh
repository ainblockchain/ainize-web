# Each script owns its stage so a nested CI invocation cannot close its parent's record.
release_stage=
release_started=
emit_release_stage() {
  [[ -n "${AINIZE_CI_RUN_ID:-}" ]] || return 0
  python3 "${AINIZE_HOST_RELEASE_STAGE_REPORTER:-$HOME/.local/lib/ainize-host-release/host-release-stage.py}" \
    "$AINIZE_CI_RUN_ID" "$SHA" "$release_stage" "$1" "$release_started" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$2"
}
end_release_stage() {
  [[ -n "$release_stage" ]] || return 0
  local status=success
  if [[ "$1" != 0 ]]; then status=failed; fi
  emit_release_stage "$status" "$1"
  release_stage=
}
begin_release_stage() {
  end_release_stage 0
  release_stage=$1
  release_started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  emit_release_stage running 0
}
