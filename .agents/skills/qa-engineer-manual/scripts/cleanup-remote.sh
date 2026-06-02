#!/usr/bin/env bash
set -euo pipefail

# Deletes stories, components, assets, and asset folders in a Storyblok space.
#
# Usage:
#   bash .claude/skills/qa-engineer-manual/scripts/cleanup-remote.sh --space <spaceId>
#
# Shared (org-level) asset libraries are global, so a full wipe is unsafe.
# --shared cleans ONLY the QA-created shared resources in a library: those whose
# name starts with the QA prefix (`${QA_SHARED_PREFIX}`). It never deletes the
# library root or any unprefixed org content.
#
#   bash .claude/skills/qa-engineer-manual/scripts/cleanup-remote.sh --shared --library <libraryId>

# shellcheck source=_common.sh
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"
load_env

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
space_id=""
shared_mode=false
library_id=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --space)
      space_id="$2"
      shift 2
      ;;
    --shared)
      shared_mode=true
      shift 1
      ;;
    --library)
      library_id="$2"
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

# Deletes a list of ids (one per line) against an endpoint. Treats 2xx and 404
# (already gone) as success. Runs in a command-substitution subshell, so it
# keeps no global state: it prints "<found> <deleted>" for the caller to total.
# Args: <delete_url_base> <label> <query_suffix> <ids>
delete_ids() {
  local url_base=$1
  local label=$2
  local query_suffix="${3:-}"
  local ids=$4
  local found_batch=0
  local deleted_batch=0
  while IFS= read -r id; do
    [ -z "${id}" ] && continue
    found_batch=$((found_batch + 1))
    status=$(curl -s -o /dev/null -w "%{http_code}" --retry 3 --retry-delay 1 \
      -X DELETE "${url_base}/${id}${query_suffix}" \
      -H "Authorization: ${STORYBLOK_TOKEN}")
    if [[ "${status}" == 2* || "${status}" == "404" ]]; then
      deleted_batch=$((deleted_batch + 1))
    else
      printf "failed to delete %s/%s (status %s)\n" "${label}" "${id}" "${status}" >&2
    fi
  done <<< "${ids}"
  printf '%s %s' "${found_batch}" "${deleted_batch}"
}

# ---------------------------------------------------------------------------
# Shared (org-level) library cleanup — prefix-scoped, never a full wipe
# ---------------------------------------------------------------------------
if [ "${shared_mode}" = true ]; then
  require_library_id
  prefix="${QA_SHARED_PREFIX}"

  # 1. Shared internal tags in the library (name prefix-matched).
  tags_url="https://mapi.storyblok.com/v1/spaces/${space_id}/shared_internal_tags"
  tags_resp=$(curl -s --retry 3 --retry-delay 1 "${tags_url}/?asset_folder_id=${library_id}" \
    -H "Authorization: ${STORYBLOK_TOKEN}")
  tag_ids=$(printf '%s' "${tags_resp}" | node -e '
    const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
    const prefix = process.argv[1];
    const items = (data.internal_tags || []).filter(t => (t.name || "").startsWith(prefix));
    process.stdout.write(items.map(t => t.id).join("\n"));
  ' "${prefix}")
  read -r bf bd <<< "$(delete_ids "${tags_url}" "${library_id}/shared_internal_tags" "?asset_folder_id=${library_id}" "${tag_ids}")"
  found_total=$((found_total + bf)); deleted_total=$((deleted_total + bd))

  # 2. Shared assets in the library (filename prefix-matched), paginated.
  assets_url="https://mapi.storyblok.com/v1/spaces/${space_id}/shared_assets"
  while true; do
    assets_resp=$(curl -s --retry 3 --retry-delay 1 \
      "${assets_url}/?in_folder=${library_id}&page=1&per_page=${per_page}" \
      -H "Authorization: ${STORYBLOK_TOKEN}")
    asset_ids=$(printf '%s' "${assets_resp}" | node -e '
      const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
      const prefix = process.argv[1];
      const name = a => a.short_filename || (a.filename || "").split("/").pop() || "";
      const items = (data.assets || []).filter(a => name(a).startsWith(prefix));
      process.stdout.write(items.map(a => a.id).join("\n"));
    ' "${prefix}")
    [ -z "${asset_ids}" ] && break
    read -r bf bd <<< "$(delete_ids "${assets_url}" "${library_id}/shared_assets" "" "${asset_ids}")"
    found_total=$((found_total + bf)); deleted_total=$((deleted_total + bd))
    [ "${bd}" -eq 0 ] && break
  done

  # 3. Shared child folders under the library (name prefix-matched, never the
  #    root). Loop so leaf folders are removed before their parents.
  folders_url="https://mapi.storyblok.com/v1/spaces/${space_id}/shared_asset_folders"
  while true; do
    folders_resp=$(curl -s --retry 3 --retry-delay 1 "${folders_url}/" \
      -H "Authorization: ${STORYBLOK_TOKEN}")
    folder_ids=$(printf '%s' "${folders_resp}" | node -e '
      const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
      const prefix = process.argv[1];
      const library = parseInt(process.argv[2]);
      const all = data.shared_asset_folders || [];
      const parentById = new Map(all.map(f => [f.id, f.parent_id == null ? null : f.parent_id]));
      const inLibrary = (id) => {
        const seen = new Set();
        let cur = id;
        while (cur != null && !seen.has(cur)) {
          if (cur === library) return true;
          seen.add(cur);
          cur = parentById.get(cur);
        }
        return false;
      };
      const items = all.filter(f =>
        f.id !== library && f.parent_id != null && (f.name || "").startsWith(prefix) && inLibrary(f.id),
      );
      // Deepest first: a child has more ancestors than its parent.
      const depth = (id) => { let d = 0, cur = parentById.get(id), seen = new Set(); while (cur != null && !seen.has(cur)) { d++; seen.add(cur); cur = parentById.get(cur); } return d; };
      items.sort((a, b) => depth(b.id) - depth(a.id));
      process.stdout.write(items.map(f => f.id).join("\n"));
    ' "${prefix}" "${library_id}")
    [ -z "${folder_ids}" ] && break
    read -r bf bd <<< "$(delete_ids "${folders_url}" "${library_id}/shared_asset_folders" "" "${folder_ids}")"
    found_total=$((found_total + bf)); deleted_total=$((deleted_total + bd))
    [ "${bd}" -eq 0 ] && break
  done

  if [ "${found_total}" -eq 0 ]; then
    printf "clean (no %s* shared resources in library %s)\n" "${prefix}" "${library_id}"
  else
    printf "deleted %s of %s %s* shared resources in library %s\n" \
      "${deleted_total}" "${found_total}" "${prefix}" "${library_id}"
  fi
  exit 0
fi

cleanup_resource() {
  local resource=$1
  local skip_name="${2:-}"
  local api_base="https://mapi.storyblok.com/v1/spaces/${space_id}/${resource}"
  local label="${space_id}/${resource}"

  while true; do
    pass_deleted=0
    response=$(curl -s --retry 3 --retry-delay 1 "${api_base}/?page=1&per_page=${per_page}" \
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
      status=$(curl -s -o /dev/null -w "%{http_code}" --retry 3 --retry-delay 1 \
        -X DELETE "${api_base}/${id}" \
        -H "Authorization: ${STORYBLOK_TOKEN}")
      # 404 = already gone (cascade-deleted by a parent folder), treat as success.
      if [[ "${status}" == 2* || "${status}" == "404" ]]; then
        deleted_total=$((deleted_total + 1))
        pass_deleted=$((pass_deleted + 1))
      else
        printf "failed to delete %s/%s (status %s)\n" "${label}" "${id}" "${status}" >&2
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
cleanup_resource "internal_tags"

if [ "${found_total}" -eq 0 ]; then
  printf "clean\n"
else
  printf "deleted %s of %s items\n" "${deleted_total}" "${found_total}"
fi
