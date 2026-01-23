#!/usr/bin/env bash
set -euo pipefail

env_file="${PWD}/.env.qa"

if [ -f "${env_file}" ]; then
  set -a
  # shellcheck source=/dev/null
  source "${env_file}"
  set +a
fi

paths=(
  ".storyblok/logs"
  ".storyblok/reports"
  ".storyblok/stories"
  ".storyblok/assets"
  ".storyblok/assets/folders"
)

count_entries() {
  local path=$1
  local count=0

  if [ -d "${path}" ]; then
    while IFS= read -r -d '' _; do
      count=$((count + 1))
    done < <(find "${path}" -mindepth 1 -print0)
  fi

  printf "%s" "${count}"
}

clean_path() {
  local path=$1

  if [ -d "${path}" ]; then
    find "${path}" -mindepth 1 -exec rm -rf {} +
  fi
}

found_total=0

for path in "${paths[@]}"; do
  found_total=$((found_total + $(count_entries "${path}")))
done

if [ "${found_total}" -eq 0 ]; then
  printf "clean\n"
  exit 0
fi

for path in "${paths[@]}"; do
  clean_path "${path}"
done

remaining_total=0

for path in "${paths[@]}"; do
  remaining_total=$((remaining_total + $(count_entries "${path}")))
done

removed_total=$((found_total - remaining_total))

printf "cleaned up %s of %s\n" "${removed_total}" "${found_total}"
