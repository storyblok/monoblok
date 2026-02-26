#!/usr/bin/env bash
set -euo pipefail

# Generates an asset sidecar JSON and writes to stdout.
# All fields are optional — without flags a generic PNG asset meta is produced.
#
# Usage:
#   bash .claude/skills/qa-engineer-manual/scripts/generate-asset.sh
#   bash .claude/skills/qa-engineer-manual/scripts/generate-asset.sh \
#     --filename "hero.png" --alt "Hero image" --title "Hero"
#   bash .claude/skills/qa-engineer-manual/scripts/generate-asset.sh \
#     --filename "private.png" --is-private --folder-id 1 > scenarios/my-scenario/assets/private.json
#   # To also copy the template PNG alongside:
#   bash .claude/skills/qa-engineer-manual/scripts/generate-asset.sh \
#     --filename "hero.png" --copy-png scenarios/my-scenario/assets/hero.png > scenarios/my-scenario/assets/hero.json

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
template_png="${SCRIPT_DIR}/../templates/asset-template.png"

id="${RANDOM}"
filename=""
alt=""
title=""
is_private=false
folder_id=""
copy_png=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --id)           id="$2";       shift 2 ;;
    --filename)     filename="$2"; shift 2 ;;
    --alt)          alt="$2";      shift 2 ;;
    --title)        title="$2";    shift 2 ;;
    --is-private)   is_private=true; shift 1 ;;
    --folder-id)    folder_id="$2"; shift 2 ;;
    --copy-png)     copy_png="$2"; shift 2 ;;
    *)              printf "warning: unknown argument '%s'\n" "$1" >&2; shift 1 ;;
  esac
done

if [ -z "${filename}" ]; then
  filename="qa-asset-${id}.png"
fi

basename_no_ext="${filename%.*}"

if [ -z "${alt}" ]; then
  alt="${basename_no_ext}"
fi

if [ -z "${title}" ]; then
  title="${alt}"
fi

if [ -n "${copy_png}" ]; then
  cp "${template_png}" "${copy_png}"
fi

node -e '
const id = parseInt(process.argv[1]);
const filename = process.argv[2];
const alt = process.argv[3];
const title = process.argv[4];
const isPrivate = process.argv[5] === "true";
const folderId = process.argv[6] ? parseInt(process.argv[6]) : undefined;

const meta = {
  id,
  short_filename: filename,
  meta_data: { alt, title },
};

if (isPrivate) {
  meta.is_private = true;
}

if (folderId !== undefined) {
  meta.asset_folder_id = folderId;
}

process.stdout.write(JSON.stringify(meta, null, 2) + "\n");
' "${id}" "${filename}" "${alt}" "${title}" "${is_private}" "${folder_id}"
