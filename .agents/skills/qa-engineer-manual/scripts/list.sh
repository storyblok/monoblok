#!/usr/bin/env bash
set -euo pipefail

# Lists resources in a Storyblok space.
#
# Usage:
#   bash .claude/skills/qa-engineer-manual/scripts/list.sh --resource stories
#   bash .claude/skills/qa-engineer-manual/scripts/list.sh --resource assets --space <spaceId>
#   bash .claude/skills/qa-engineer-manual/scripts/list.sh --resource components
#   bash .claude/skills/qa-engineer-manual/scripts/list.sh --resource datasources
#
# Shared (org-level) asset libraries — require --library <libraryId> for the
# asset/tag listings (a top-level shared asset folder id):
#   bash .claude/skills/qa-engineer-manual/scripts/list.sh --resource shared-assets --library <libraryId>
#   bash .claude/skills/qa-engineer-manual/scripts/list.sh --resource shared-folders
#   bash .claude/skills/qa-engineer-manual/scripts/list.sh --resource shared-tags --library <libraryId>

# shellcheck source=_common.sh
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"
load_env

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
space_id=""
resource=""
library_id=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --space)    space_id="$2"; shift 2 ;;
    --resource) resource="$2"; shift 2 ;;
    --library)  library_id="$2"; shift 2 ;;
    *)          printf "warning: unknown argument '%s'\n" "$1" >&2; shift 1 ;;
  esac
done

require_space_id

if [ -z "${resource}" ]; then
  printf "Missing --resource <stories|assets|components|datasources|shared-assets|shared-folders|shared-tags>.\n" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Per-resource formatters (inline Node.js)
# ---------------------------------------------------------------------------
# Each formatter receives the response `data` and a `key` (the array property),
# prints rows to stdout, then a final line: __COUNT__<n>
format_stories='
  const items = data[key] || [];
  items.forEach(s =>
    process.stdout.write(s.id + "\t" + s.slug + "\t" + (s.published ? "published" : "draft") + "\n")
  );
  process.stdout.write("__COUNT__" + items.length + "\n");
'

format_assets='
  const items = data[key] || [];
  items.forEach(a => {
    const name = (a.short_filename || (a.filename || "").split("/").pop());
    const folder = a.asset_folder_id || "-";
    process.stdout.write(a.id + "\t" + name + "\t" + folder + "\n");
  });
  process.stdout.write("__COUNT__" + items.length + "\n");
'

format_components='
  const items = data[key] || [];
  items.forEach(c => {
    const root = c.is_root ? "root" : "-";
    const nestable = c.is_nestable ? "nestable" : "-";
    process.stdout.write(c.id + "\t" + c.name + "\t" + root + "\t" + nestable + "\n");
  });
  process.stdout.write("__COUNT__" + items.length + "\n");
'

format_datasources='
  const items = data[key] || [];
  items.forEach(d => {
    const dims = (d.dimensions || []).length;
    process.stdout.write(d.id + "\t" + d.slug + "\t" + d.name + "\t" + dims + " dims\n");
  });
  process.stdout.write("__COUNT__" + items.length + "\n");
'

format_shared_folders='
  const items = data[key] || [];
  const lib = libArg ? parseInt(libArg) : undefined;
  items
    .filter(f => lib === undefined || f.id === lib || f.parent_id === lib)
    .forEach(f => {
      const parent = f.parent_id == null ? "root" : f.parent_id;
      const access = (f.asset_folder_access || []).map(a => a.space_id + ":" + a.access_level).join(",") || "-";
      process.stdout.write(f.id + "\t" + f.name + "\t" + parent + "\t" + access + "\n");
    });
  process.stdout.write("__COUNT__" + items.length + "\n");
'

format_shared_tags='
  const items = data[key] || [];
  items.forEach(t => process.stdout.write(t.id + "\t" + t.name + "\n"));
  process.stdout.write("__COUNT__" + items.length + "\n");
'

# Resolve resource → path segment, response key, formatter, extra query string.
extra_query=""
case "${resource}" in
  stories)       path_segment="stories";              response_key="stories";              format_js="${format_stories}" ;;
  assets)        path_segment="assets";               response_key="assets";               format_js="${format_assets}" ;;
  components)    path_segment="components";           response_key="components";           format_js="${format_components}" ;;
  datasources)   path_segment="datasources";          response_key="datasources";          format_js="${format_datasources}" ;;
  shared-assets) require_library_id; path_segment="shared_assets";        response_key="assets";        format_js="${format_assets}";        extra_query="&in_folder=${library_id}" ;;
  shared-folders) path_segment="shared_asset_folders"; response_key="shared_asset_folders"; format_js="${format_shared_folders}" ;;
  shared-tags)   require_library_id; path_segment="shared_internal_tags"; response_key="internal_tags"; format_js="${format_shared_tags}";   extra_query="&asset_folder_id=${library_id}" ;;
  *)
    printf "Unknown resource '%s'. Use stories, assets, components, datasources, shared-assets, shared-folders, or shared-tags.\n" "${resource}" >&2
    exit 1
    ;;
esac

# ---------------------------------------------------------------------------
# Paginate and print
# ---------------------------------------------------------------------------
per_page=100
page=1
total=0

while true; do
  response=$(curl -s --retry 3 --retry-delay 1 \
    "https://mapi.storyblok.com/v1/spaces/${space_id}/${path_segment}/?page=${page}&per_page=${per_page}${extra_query}" \
    -H "Authorization: ${STORYBLOK_TOKEN}")

  output=$(printf '%s' "${response}" | node -e "
    const data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
    const libArg = process.argv[1];
    const key = process.argv[2];
    ${format_js}
  " "${library_id}" "${response_key}")

  # Last line is __COUNT__<n>; everything before it is row output
  batch="${output##*__COUNT__}"
  rows="${output%__COUNT__*}"

  if [ -n "${rows}" ]; then
    printf '%s' "${rows}"
  fi

  total=$((total + batch))

  if [ "${batch}" -lt "${per_page}" ]; then
    break
  fi
  page=$((page + 1))
done

printf "%s %s\n" "${total}" "${resource}"
