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

printf "Seeding 1 public + 1 private asset into space %s...\n" "${space_id}"
./.claude/skills/qa-engineer-manual/scripts/asset-create.sh \
  --space "${space_id}" \
  --size 600x400 \
  --filename qa-public.png

./.claude/skills/qa-engineer-manual/scripts/asset-create.sh \
  --space "${space_id}" \
  --size 600x400 \
  --filename qa-private.png \
  --private
