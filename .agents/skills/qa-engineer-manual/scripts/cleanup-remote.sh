#!/usr/bin/env bash
set -euo pipefail

# Deletes stories, components, assets, and asset folders in a Storyblok space.
#
# Usage:
#   bash .claude/skills/qa-engineer-manual/scripts/cleanup-remote.sh --space <spaceId>
#
# Shared (org-level) asset libraries are global, so a full wipe is unsafe.
# --shared cleans every shared resource that belongs to ONE library, scoped by
# folder membership (not by name): all assets in the library's folder tree, all
# internal tags scoped to the library, and all child folders. Transferred assets
# keep their original names, so folder scoping catches them where a name prefix
# would not. It never deletes the library root folder (org context only) or any
# resource outside the given library.
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
# Shared (org-level) library cleanup — folder-scoped, never a full wipe
# ---------------------------------------------------------------------------
if [ "${shared_mode}" = true ]; then
  require_library_id

  folders_url="https://mapi.storyblok.com/v1/spaces/${space_id}/shared_asset_folders"
  assets_url="https://mapi.storyblok.com/v1/spaces/${space_id}/shared_assets"
  tags_url="https://mapi.storyblok.com/v1/spaces/${space_id}/shared_internal_tags"

  # Resolve every folder id in the library's tree (root first, then children).
  # Assets are scoped per folder, so the tree drives which assets get deleted.
  folders_resp=$(curl -s --retry 3 --retry-delay 1 "${folders_url}/" \
    -H "Authorization: ${STORYBLOK_TOKEN}")
  tree_ids=$(printf '%s' "${folders_resp}" | node -e '
    const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
    const library = parseInt(process.argv[1]);
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
    const ids = all.filter(f => f.id !== library && inLibrary(f.id)).map(f => f.id);
    // Root first so its assets are enumerated even if the folder list is empty.
    process.stdout.write([library, ...ids].join("\n"));
  ' "${library_id}")

  # 1. Shared assets in every folder of the library tree (no name filter),
  #    paginated per folder.
  while IFS= read -r folder; do
    [ -z "${folder}" ] && continue
    while true; do
      assets_resp=$(curl -s --retry 3 --retry-delay 1 \
        "${assets_url}/?in_folder=${folder}&page=1&per_page=${per_page}" \
        -H "Authorization: ${STORYBLOK_TOKEN}")
      asset_ids=$(printf '%s' "${assets_resp}" | node -e '
        const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
        process.stdout.write((data.assets || []).map(a => a.id).join("\n"));
      ')
      [ -z "${asset_ids}" ] && break
      read -r bf bd <<< "$(delete_ids "${assets_url}" "${folder}/shared_assets" "" "${asset_ids}")"
      found_total=$((found_total + bf)); deleted_total=$((deleted_total + bd))
      [ "${bd}" -eq 0 ] && break
    done
  done <<< "${tree_ids}"

  # 2. Shared internal tags scoped to the library (no name filter), paginated
  #    per pass: delete a page, then re-fetch page 1 until none remain.
  while true; do
    tags_resp=$(curl -s --retry 3 --retry-delay 1 \
      "${tags_url}/?asset_folder_id=${library_id}&page=1&per_page=${per_page}" \
      -H "Authorization: ${STORYBLOK_TOKEN}")
    tag_ids=$(printf '%s' "${tags_resp}" | node -e '
      const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
      process.stdout.write((data.internal_tags || []).map(t => t.id).join("\n"));
    ')
    [ -z "${tag_ids}" ] && break
    read -r bf bd <<< "$(delete_ids "${tags_url}" "${library_id}/shared_internal_tags" "?asset_folder_id=${library_id}" "${tag_ids}")"
    found_total=$((found_total + bf)); deleted_total=$((deleted_total + bd))
    [ "${bd}" -eq 0 ] && break
  done

  # 3. Shared child folders in the library tree (never the root), deepest first
  #    so leaf folders are removed before their parents.
  while true; do
    folders_resp=$(curl -s --retry 3 --retry-delay 1 "${folders_url}/" \
      -H "Authorization: ${STORYBLOK_TOKEN}")
    folder_ids=$(printf '%s' "${folders_resp}" | node -e '
      const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
      const library = parseInt(process.argv[1]);
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
        f.id !== library && f.parent_id != null && inLibrary(f.id),
      );
      // Deepest first: a child has more ancestors than its parent.
      const depth = (id) => { let d = 0, cur = parentById.get(id), seen = new Set(); while (cur != null && !seen.has(cur)) { d++; seen.add(cur); cur = parentById.get(cur); } return d; };
      items.sort((a, b) => depth(b.id) - depth(a.id));
      process.stdout.write(items.map(f => f.id).join("\n"));
    ' "${library_id}")
    [ -z "${folder_ids}" ] && break
    read -r bf bd <<< "$(delete_ids "${folders_url}" "${library_id}/shared_asset_folders" "" "${folder_ids}")"
    found_total=$((found_total + bf)); deleted_total=$((deleted_total + bd))
    [ "${bd}" -eq 0 ] && break
  done

  if [ "${found_total}" -eq 0 ]; then
    printf "clean (no shared resources in library %s)\n" "${library_id}"
  else
    printf "deleted %s of %s shared resources in library %s\n" \
      "${deleted_total}" "${found_total}" "${library_id}"
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
