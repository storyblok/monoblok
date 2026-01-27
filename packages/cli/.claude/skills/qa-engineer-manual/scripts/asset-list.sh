#!/usr/bin/env bash
set -euo pipefail

env_file="${PWD}/.env.qa"

if [ -f "${env_file}" ]; then
  set -a
  # shellcheck source=/dev/null
  source "${env_file}"
  set +a
fi

: "${STORYBLOK_SPACE_ID:?Missing STORYBLOK_SPACE_ID}"
: "${STORYBLOK_TOKEN:?Missing STORYBLOK_TOKEN}"

space_id="${STORYBLOK_SPACE_ID}"
per_page=100

while [ "$#" -gt 0 ]; do
  case "$1" in
    --space)
      space_id="$2"
      shift 2
      ;;
    --per-page)
      per_page="$2"
      shift 2
      ;;
    *)
      shift 1
      ;;
  esac
done

response=$(curl -s "https://mapi.storyblok.com/v1/spaces/${space_id}/assets/?per_page=${per_page}" \
  -H "Authorization: ${STORYBLOK_TOKEN}")

printf '%s' "${response}" | node -e 'const fs=require("fs");const data=JSON.parse(fs.readFileSync(0,"utf8"));const assets=data.assets||[];console.log(`count:${assets.length}`);for(const asset of assets){console.log(`${asset.id}:${asset.filename}`);}'
