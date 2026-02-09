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

per_page=100
found_total=0
deleted_total=0

cleanup_resource() {
  local space_id=$1
  local resource=$2
  local api_base="https://mapi.storyblok.com/v1/spaces/${space_id}/${resource}"
  local label="${space_id}/${resource}"

  while true; do
    pass_deleted=0
    response=$(curl -s "${api_base}/?page=1&per_page=${per_page}" \
      -H "Authorization: ${STORYBLOK_TOKEN}")
    ids=$(printf '%s' "${response}" | node -e 'const fs=require("fs");const data=JSON.parse(fs.readFileSync(0,"utf8"));const key=process.argv[1];const resource=process.argv[2];const items=data[key]||[];const filtered=resource==="components"?items.filter((item)=>item.name!=="page"):items;process.stdout.write(filtered.map((item)=>item.id).join("\n"));' "${resource}" "${resource}")
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

cleanup_space() {
  local space_id=$1

  cleanup_resource "${space_id}" "stories"
  cleanup_resource "${space_id}" "components"
  cleanup_resource "${space_id}" "assets"
  cleanup_resource "${space_id}" "asset_folders"
}

cleanup_space "${STORYBLOK_SPACE_ID}"

if [ -n "${STORYBLOK_SPACE_ID_TARGET:-}" ]; then
  cleanup_space "${STORYBLOK_SPACE_ID_TARGET}"
fi

if [ "${found_total}" -eq 0 ]; then
  printf "clean\n"
  exit 0
fi

printf "cleaned up %s of %s\n" "${deleted_total}" "${found_total}"
