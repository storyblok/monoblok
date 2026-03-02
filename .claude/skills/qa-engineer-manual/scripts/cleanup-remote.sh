#!/usr/bin/env bash
set -euo pipefail

# Deletes stories, components, assets, and asset folders in a Storyblok space.
#
# Usage:
#   bash .claude/skills/qa-engineer-manual/scripts/cleanup-remote.sh --space <spaceId>

# shellcheck source=_common.sh
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"
load_env

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
space_id=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --space)
      space_id="$2"
      shift 2
      ;;
    *)
      printf "warning: unknown argument '%s'\n" "$1" >&2
      shift 1
      ;;
  esac
done

require_space_id

# ---------------------------------------------------------------------------
# Cleanup logic
# ---------------------------------------------------------------------------
per_page=100
found_total=0
deleted_total=0

cleanup_resource() {
  local resource=$1
  local skip_name="${2:-}"
  local api_base="https://mapi.storyblok.com/v1/spaces/${space_id}/${resource}"
  local label="${space_id}/${resource}"

  while true; do
    pass_deleted=0
    response=$(curl -s "${api_base}/?page=1&per_page=${per_page}" \
      -H "Authorization: ${STORYBLOK_TOKEN}")
    ids=$(printf '%s' "${response}" | node -e '
      const fs = require("fs");
      const data = JSON.parse(fs.readFileSync(0, "utf8"));
      const resource = process.argv[1];
      const skipName = process.argv[2] || "";
      const items = (data[resource] || []).filter((item) => !skipName || item.name !== skipName);
      // Non-folders first so children are deleted before parent folders cascade-delete them
      items.sort((a, b) => (a.is_folder === b.is_folder ? 0 : a.is_folder ? 1 : -1));
      process.stdout.write(items.map((item) => item.id).join("\n"));
    ' "${resource}" "${skip_name}")
    if [ -z "${ids}" ]; then
      break
    fi
    while IFS= read -r id; do
      [ -z "${id}" ] && continue
      found_total=$((found_total + 1))
      status=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "${api_base}/${id}" \
        -H "Authorization: ${STORYBLOK_TOKEN}")
      if [[ "${status}" != 2* ]]; then
        printf "failed to delete %s/%s (status %s)\n" "${label}" "${id}" "${status}" >&2
      fi
      if [[ "${status}" == 2* ]]; then
        deleted_total=$((deleted_total + 1))
        pass_deleted=$((pass_deleted + 1))
      fi
    done <<< "${ids}"
    if [ "${pass_deleted}" -eq 0 ]; then
      break
    fi
  done
}

cleanup_resource "stories"
cleanup_resource "components" "page"
cleanup_resource "assets"
cleanup_resource "asset_folders"

if [ "${found_total}" -eq 0 ]; then
  printf "clean\n"
else
  printf "deleted %s of %s items\n" "${deleted_total}" "${found_total}"
fi
