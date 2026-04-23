#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
skill_root="$(cd "${script_dir}/.." && pwd)"
repo_root="$(cd "${skill_root}/../../.." && pwd)"
default_target="${repo_root}/packages/migrations/playground/wordpress-astro/wordpress"
target_dir="${1:-$default_target}"

if [[ ! -d "$target_dir" ]]; then
  echo "Target directory not found: ${target_dir}" >&2
  exit 1
fi

cd "$target_dir"

if [[ ! -f compose.yaml ]]; then
  echo "Target directory must contain compose.yaml: ${target_dir}" >&2
  exit 1
fi

docker compose run --rm \
  --volume "${script_dir}:/scripts:ro" \
  -e SBP_FORCE \
  -e SBP_SCALE \
  wp-cli wp eval-file /scripts/seed.php
