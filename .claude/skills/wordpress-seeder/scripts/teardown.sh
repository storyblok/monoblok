#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
skill_root="$(cd "${script_dir}/.." && pwd)"
repo_root="$(cd "${skill_root}/../../.." && pwd)"
default_target="${repo_root}/packages/migrations/playground/wordpress-astro/wordpress"
target_dir=""

remove_volumes=0
for arg in "$@"; do
  case "$arg" in
    -v|--volumes)
      remove_volumes=1
      ;;
    *)
      if [[ -n "$target_dir" ]]; then
        echo "Unexpected argument: $arg" >&2
        exit 1
      fi
      target_dir="$arg"
      ;;
  esac
done

target_dir="${target_dir:-$default_target}"

if [[ ! -d "$target_dir" ]]; then
  echo "Target directory not found: ${target_dir}" >&2
  exit 1
fi

cd "$target_dir"

if [[ ! -f compose.yaml ]]; then
  echo "Target directory must contain compose.yaml: ${target_dir}" >&2
  exit 1
fi

if [[ $remove_volumes -eq 1 ]]; then
  echo "==> Stopping stack and removing volumes (db + wp data will be wiped)"
  docker compose down -v
else
  echo "==> Stopping stack (volumes preserved)"
  docker compose down
fi
