#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

readonly docker_bin="${YGH_DOCKER_BIN:-docker}"
readonly restic_bin="${YGH_RESTIC_BIN:-restic}"
readonly journalctl_bin="${YGH_JOURNALCTL_BIN:-journalctl}"
readonly compose_file="${YGH_COMPOSE_FILE:-/var/lib/ygh/compose.yaml}"
readonly stage_root="${YGH_BACKUP_STAGE_ROOT:-/var/lib/ygh/backups/staging}"
readonly state_root="${YGH_BACKUP_STATE_ROOT:-/var/lib/ygh/backups/state}"
readonly lock_path="${YGH_MAINTENANCE_LOCK:-/run/lock/ygh-maintenance.lock}"
readonly retention_enabled="${YGH_BACKUP_RETENTION_ENABLED:-false}"
readonly container_uid="${YGH_BACKUP_CONTAINER_UID:-1000}"
readonly container_gid="${YGH_BACKUP_CONTAINER_GID:-1000}"
readonly mode="${1:-backup}"
readonly app_stage="$stage_root/app"
readonly logs_stage="$stage_root/logs"

app_container_id=""
app_image_id=""
app_volume=""
app_stopped=0
stage_owned=0

say() { printf '%s\n' "$1"; }

ensure_application_started() {
  local is_running
  is_running="$("$docker_bin" inspect --format '{{.State.Running}}' "$app_container_id" 2>/dev/null || true)"
  if [[ "$is_running" != "true" ]]; then
    "$docker_bin" start "$app_container_id" >/dev/null 2>&1 || return 1
  fi
  for _ in {1..30}; do
    is_running="$("$docker_bin" inspect --format '{{.State.Running}}' "$app_container_id" 2>/dev/null || true)"
    if [[ "$is_running" == "true" ]]; then
      sleep 1
      is_running="$("$docker_bin" inspect --format '{{.State.Running}}' "$app_container_id" 2>/dev/null || true)"
      if [[ "$is_running" == "true" ]]; then
        app_stopped=0
        return 0
      fi
    fi
    sleep 1
  done
  return 1
}

finish() {
  local result=$?
  trap - EXIT
  if [[ "$app_stopped" == 1 ]] && ! ensure_application_started; then
    say "Backup failed and the application could not be restarted; operator action is required."
    result=2
  fi
  if [[ "$stage_owned" == 1 ]]; then rm -rf -- "$app_stage" "$logs_stage"; fi
  exit "$result"
}
trap finish EXIT
trap 'exit 1' INT TERM HUP

fail() {
  say "Backup failed; no success signal was emitted."
  exit 1
}

: "${RESTIC_REPOSITORY:?Backup repository configuration is missing.}"
: "${RESTIC_PASSWORD:?Backup repository configuration is missing.}"
: "${AWS_ACCESS_KEY_ID:?Backup repository configuration is missing.}"
: "${AWS_SECRET_ACCESS_KEY:?Backup repository configuration is missing.}"
if [[ "$retention_enabled" != "true" && "$retention_enabled" != "false" ]]; then
  say "Backup retention setting must be true or false."
  exit 1
fi
if [[ "$mode" != "backup" && "$mode" != "--retention-dry-run" ]]; then
  say "Unknown backup operation."
  exit 1
fi

case "$stage_root" in
  /var/lib/ygh/backups/staging|/var/lib/ygh/backups/staging/*|/tmp/*) ;;
  *) say "Backup staging path is outside its permitted roots."; exit 1 ;;
esac
if [[ -L "$stage_root" ]]; then
  say "Backup staging path must not be a symbolic link."
  exit 1
fi
mkdir -p -- "$(dirname "$lock_path")" "$stage_root"
canonical_stage_root="$(realpath -m -- "$stage_root")"
case "$canonical_stage_root" in
  /var/lib/ygh/backups/staging|/var/lib/ygh/backups/staging/*|/tmp/*) ;;
  *) say "Backup staging path resolves outside its permitted roots."; exit 1 ;;
esac
if [[ "$canonical_stage_root" == /tmp ]]; then
  say "Backup staging path must be a dedicated directory."
  exit 1
fi
exec 9>"$lock_path"
if ! flock --exclusive --timeout 1800 9; then
  say "Backup could not acquire the maintenance lock."
  exit 1
fi
mkdir -p -- "$state_root"
install -d -o root -g root -m 0700 -- "$state_root/restic-cache"

restic() {
  "$restic_bin" --cache-dir "$state_root/restic-cache" "$@"
}

if [[ "$mode" == "--retention-dry-run" ]]; then
  preview_file="${YGH_RETENTION_PREVIEW_FILE:-$state_root/retention-preview-$(date -u +%Y%m%dT%H%M%SZ).txt}"
  if ! restic forget --dry-run --group-by host,paths,tags --tag ygh-app \
    --keep-daily 30 --keep-monthly 12 >"$preview_file" 2>/dev/null || \
    ! restic forget --dry-run --group-by host,paths,tags --tag ygh-logs \
      --keep-within 30d >>"$preview_file" 2>/dev/null; then
    rm -f -- "$preview_file"
    fail
  fi
  chmod 0600 "$preview_file"
  say "Retention preview written to the root-only report; no snapshots were changed."
  exit 0
fi

stage_owned=1
rm -rf -- "$app_stage" "$logs_stage"
install -d -o "$container_uid" -g "$container_gid" -m 0700 -- "$app_stage"
install -d -o root -g root -m 0700 -- "$logs_stage"

mapfile -t app_container_ids < <("$docker_bin" compose --project-directory /var/lib/ygh -f "$compose_file" ps --all --quiet app 2>/dev/null)
if [[ "${#app_container_ids[@]}" != 1 ]]; then fail; fi
app_container_id="${app_container_ids[0]}"
[[ "$app_container_id" =~ ^[0-9a-f]{12,64}$ ]] || fail
local_state="$("$docker_bin" inspect --format '{{.State.Running}}|{{.Image}}|{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}' "$app_container_id" 2>/dev/null)" || fail
IFS='|' read -r app_running app_image_id app_volume <<<"$local_state"
[[ "$app_running" == "true" ]] || fail
[[ "$app_image_id" =~ ^sha256:[a-f0-9]{64}$ ]] || fail
[[ "$app_volume" =~ ^[A-Za-z0-9_.-]+$ ]] || fail

app_stopped=1
if ! "$docker_bin" stop --time 10 "$app_container_id" >/dev/null 2>&1; then fail; fi

if ! "$docker_bin" run --rm --network none --read-only \
  --tmpfs /tmp:rw,nosuid,nodev,noexec,size=16m \
  --user 1000:1000 --workdir /app \
  --mount "type=volume,src=$app_volume,dst=/data,readonly" \
  --mount "type=bind,src=$app_stage,dst=/backup" \
  --env YGH_BACKUP_STAGE=/backup \
  --entrypoint node "$app_image_id" scripts/backup-snapshot.ts snapshot >/dev/null 2>&1; then
  fail
fi

ensure_application_started || fail

if ! "$docker_bin" run --rm --network none --read-only \
  --tmpfs /tmp:rw,nosuid,nodev,noexec,size=16m \
  --user 1000:1000 --workdir /app \
  --mount "type=bind,src=$app_stage,dst=/backup" \
  --env YGH_BACKUP_STAGE=/backup \
  --env "YGH_BACKUP_IMAGE_ID=$app_image_id" \
  --entrypoint node "$app_image_id" scripts/backup-snapshot.ts finalize >/dev/null 2>&1; then
  fail
fi

today_utc="$(date -u +%F)"
yesterday_utc="$(date -u -d 'yesterday 00:00:00' +%F)"
window_start="${yesterday_utc} 00:00:00 UTC"
window_end="${today_utc} 00:00:00 UTC"
if ! "$journalctl_bin" --since="$window_start" --until="$window_end" --output=export --no-pager >"$logs_stage/journal.export" 2>/dev/null; then
  fail
fi
cat >"$logs_stage/window.json" <<EOF
{"startUtc":"${yesterday_utc}T00:00:00Z","endUtc":"${today_utc}T00:00:00Z"}
EOF
chmod 0600 "$logs_stage/window.json" "$logs_stage/journal.export"

hostname_value="$(hostname -f 2>/dev/null || hostname)"
if ! restic snapshots >/dev/null 2>&1; then
  fail
fi
if ! restic backup --host "$hostname_value" --tag ygh-app "$app_stage" >/dev/null 2>&1; then
  fail
fi
if ! restic backup --host "$hostname_value" --tag ygh-logs "$logs_stage" >/dev/null 2>&1; then
  fail
fi

if [[ "$retention_enabled" == "true" ]]; then
  if ! restic forget --group-by host,paths,tags --tag ygh-app \
    --keep-daily 30 --keep-monthly 12 >/dev/null 2>&1; then
    fail
  fi
  if ! restic forget --group-by host,paths,tags --tag ygh-logs \
    --keep-within 30d >/dev/null 2>&1; then
    fail
  fi
  if [[ "$(date -u +%u)" == "7" ]]; then
    if ! restic prune >/dev/null 2>&1; then fail; fi
    if ! restic check >/dev/null 2>&1; then fail; fi
  fi
fi

month_marker="$state_root/read-data-check-month"
current_month="$(date -u +%Y-%m)"
previous_month="$(cat "$month_marker" 2>/dev/null || true)"
if [[ "$previous_month" != "$current_month" ]]; then
  if ! restic check --read-data >/dev/null 2>&1; then fail; fi
  printf '%s\n' "$current_month" >"$month_marker"
  chmod 0600 "$month_marker"
fi

say "Backup completed successfully."
