#!/usr/bin/env bash
set -euo pipefail

# Lists resources in a Storyblok space.
#
# Usage:
#   bash .claude/skills/qa-engineer-manual/scripts/list.sh --resource stories
#   bash .claude/skills/qa-engineer-manual/scripts/list.sh --resource assets --space <spaceId>
#   bash .claude/skills/qa-engineer-manual/scripts/list.sh --resource components
#   bash .claude/skills/qa-engineer-manual/scripts/list.sh --resource datasources

# shellcheck source=_common.sh
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"
load_env

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
space_id=""
resource=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --space)    space_id="$2"; shift 2 ;;
    --resource) resource="$2"; shift 2 ;;
    *)          printf "warning: unknown argument '%s'\n" "$1" >&2; shift 1 ;;
  esac
done

require_space_id

if [ -z "${resource}" ]; then
  printf "Missing --resource <stories|assets|components|datasources>.\n" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Per-resource formatters (inline Node.js)
# ---------------------------------------------------------------------------
# Each formatter prints rows to stdout, then a final line: __COUNT__<n>
format_stories='
  const items = data.stories || [];
  items.forEach(s =>
    process.stdout.write(s.id + "\t" + s.slug + "\t" + (s.published ? "published" : "draft") + "\n")
  );
  process.stdout.write("__COUNT__" + items.length + "\n");
'

format_assets='
  const items = data.assets || [];
  items.forEach(a => {
    const name = (a.filename || "").split("/").pop();
    const folder = a.asset_folder_id || "-";
    process.stdout.write(a.id + "\t" + name + "\t" + folder + "\n");
  });
  process.stdout.write("__COUNT__" + items.length + "\n");
'

format_components='
  const items = data.components || [];
  items.forEach(c => {
    const root = c.is_root ? "root" : "-";
    const nestable = c.is_nestable ? "nestable" : "-";
    process.stdout.write(c.id + "\t" + c.name + "\t" + root + "\t" + nestable + "\n");
  });
  process.stdout.write("__COUNT__" + items.length + "\n");
'

format_datasources='
  const items = data.datasources || [];
  items.forEach(d => {
    const dims = (d.dimensions || []).length;
    process.stdout.write(d.id + "\t" + d.slug + "\t" + d.name + "\t" + dims + " dims\n");
  });
  process.stdout.write("__COUNT__" + items.length + "\n");
'

case "${resource}" in
  stories)     format_js="${format_stories}" ;;
  assets)      format_js="${format_assets}" ;;
  components)  format_js="${format_components}" ;;
  datasources) format_js="${format_datasources}" ;;
  *)
    printf "Unknown resource '%s'. Use stories, assets, components, or datasources.\n" "${resource}" >&2
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
  response=$(curl -s \
    "https://mapi.storyblok.com/v1/spaces/${space_id}/${resource}/?page=${page}&per_page=${per_page}" \
    -H "Authorization: ${STORYBLOK_TOKEN}")

  output=$(printf '%s' "${response}" | node -e "
    const data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
    ${format_js}
  ")

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
