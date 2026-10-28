#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# != 2 || ( "$2" != true && "$2" != false ) ]]; then
  printf '%s\n' "Database deployment expects its root directory and initialization flag." >&2
  exit 1
fi

persistent_root="$1"
initialize_database="$2"
compose() {
  docker compose --project-directory "$persistent_root" \
    -f "$persistent_root/compose.yaml" "$@"
}

existing_container="$(compose ps --all --quiet app)"
if [[ -n "$existing_container" ]]; then compose stop app; fi
compose run --rm --no-deps \
  -e "YGH_INITIALIZE_DATABASE=$initialize_database" \
  app node scripts/deploy-database.ts
compose up -d --no-build app
