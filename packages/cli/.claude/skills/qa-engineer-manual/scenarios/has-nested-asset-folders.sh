#!/usr/bin/env bash
set -euo pipefail

env_file="${PWD}/.env.qa"

if [ -f "${env_file}" ]; then
  set -a
  # shellcheck source=/dev/null
  source "${env_file}"
  set +a
fi

: "${STORYBLOK_TOKEN:?Missing STORYBLOK_TOKEN}"

space_id="${STORYBLOK_SPACE_ID:-}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --space)
      space_id="$2"
      shift 2
      ;;
    *)
      shift 1
      ;;
  esac
done

if [ -z "${space_id}" ]; then
  printf "Missing --space or STORYBLOK_SPACE_ID.\n" >&2
  exit 1
fi

printf "Seeding nested asset folder structure into space %s...\n" "${space_id}"

folder_a_id=$(./.claude/skills/qa-engineer-manual/scripts/asset-folder-create.sh \
  --space "${space_id}" \
  --name "QA Folder A" \
  --parent-id 0 \
  --print-id)

folder_b_id=$(./.claude/skills/qa-engineer-manual/scripts/asset-folder-create.sh \
  --space "${space_id}" \
  --name "QA Folder B" \
  --parent-id "${folder_a_id}" \
  --print-id)

printf "created folder %s (QA Folder A)\n" "${folder_a_id}"
printf "created folder %s (QA Folder B, nested)\n" "${folder_b_id}"

printf "Seeding 3 public assets, with 2 inside folders...\n"
./.claude/skills/qa-engineer-manual/scripts/asset-create.sh \
  --space "${space_id}" \
  --size 800x600 \
  --filename qa-root.png

./.claude/skills/qa-engineer-manual/scripts/asset-create.sh \
  --space "${space_id}" \
  --size 800x600 \
  --filename qa-in-folder-a.png \
  --folder-id "${folder_a_id}"

./.claude/skills/qa-engineer-manual/scripts/asset-create.sh \
  --space "${space_id}" \
  --size 800x600 \
  --filename qa-in-folder-b.png \
  --folder-id "${folder_b_id}"
