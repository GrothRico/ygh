#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

readonly docker_bin="${YGH_DOCKER_BIN:-docker}"
readonly compose_file="${YGH_COMPOSE_FILE:-/var/lib/ygh/compose.yaml}"
readonly lock_path="${YGH_MAINTENANCE_LOCK:-/run/lock/ygh-maintenance.lock}"
readonly project_directory="${YGH_PROJECT_DIRECTORY:-/var/lib/ygh}"
readonly app_network="${YGH_APP_NETWORK:-ygh-app-private}"

worker_container_id=""

say() { printf '%s\n' "$1"; }

cleanup_worker() {
  [[ -n "$worker_container_id" ]] || return 0
  "$docker_bin" rm --force "$worker_container_id" >/dev/null 2>&1 || return 1
  worker_container_id=""
}

finish() {
  local result=$?
  trap - EXIT
  if ! cleanup_worker; then
    say "Catalog refresh worker cleanup failed; operator inspection is required."
    result=1
  fi
  exit "$result"
}
trap finish EXIT
trap 'exit 1' INT TERM HUP

fail() {
  say "Catalog refresh failed; inspect catalog status and host logs."
  exit 1
}

if [[ ! "$project_directory" =~ ^/[A-Za-z0-9_./-]+$ || "$project_directory" == *..* ]]; then
  say "Catalog refresh project directory is invalid."
  exit 1
fi
if [[ ! "$compose_file" =~ ^/[A-Za-z0-9_./-]+$ || "$compose_file" == *..* ]]; then
  say "Catalog refresh Compose path is invalid."
  exit 1
fi
if [[ ! "$app_network" =~ ^[A-Za-z0-9_.-]+$ ]]; then
  say "Catalog refresh network name is invalid."
  exit 1
fi

mkdir -p -- "$(dirname -- "$lock_path")"
exec 9>"$lock_path"
if ! flock --nonblock --exclusive 9; then
  say "Catalog refresh skipped because another maintenance task holds the lock."
  exit 0
fi

compose_output="$("$docker_bin" compose --project-directory "$project_directory" -f "$compose_file" ps --all --quiet app 2>/dev/null)" || fail
[[ -n "$compose_output" ]] || fail
mapfile -t app_container_ids <<<"$compose_output"
if [[ "${#app_container_ids[@]}" != 1 ]]; then fail; fi
app_container_id="${app_container_ids[0]}"
[[ "$app_container_id" =~ ^[0-9a-f]{12,64}$ ]] || fail

local_state="$("$docker_bin" inspect --format '{{.State.Running}}|{{.Image}}|{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}' "$app_container_id" 2>/dev/null)" || fail
IFS='|' read -r app_running app_image_id app_volume <<<"$local_state"
[[ "$app_running" == "true" ]] || fail
[[ "$app_image_id" =~ ^sha256:[a-f0-9]{64}$ ]] || fail
[[ "$app_volume" =~ ^[A-Za-z0-9_.-]+$ ]] || fail

worker_command='node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/catalog-sync.mts sync && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/catalog-images.mts sync'
worker_container_id="$("$docker_bin" create \
  --pull=never \
  --label com.ygh.maintenance=catalog-update \
  --network "$app_network" \
  --read-only \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --tmpfs /tmp:rw,nosuid,nodev,noexec,size=16m \
  --user 1000:1000 \
  --workdir /app \
  --mount "type=volume,src=$app_volume,dst=/data" \
  --env DATABASE_PATH=/data/collection.sqlite \
  --entrypoint /bin/sh \
  "$app_image_id" -c "$worker_command" 2>/dev/null)" || fail
[[ "$worker_container_id" =~ ^[0-9a-f]{12,64}$ ]] || { worker_container_id=""; fail; }

if ! "$docker_bin" start --attach "$worker_container_id"; then
  fail
fi
worker_state="$("$docker_bin" inspect --format '{{.State.Running}}|{{.State.ExitCode}}' "$worker_container_id" 2>/dev/null)" || fail
IFS='|' read -r worker_running worker_exit_code <<<"$worker_state"
[[ "$worker_running" == "false" && "$worker_exit_code" == "0" ]] || fail

if ! cleanup_worker; then
  worker_container_id=""
  say "Catalog refresh worker cleanup failed; operator inspection is required."
  exit 1
fi

say "Catalog metadata and missing images refreshed successfully."
