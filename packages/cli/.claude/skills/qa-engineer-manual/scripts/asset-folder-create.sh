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
name=""
parent_id=0
print_id=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --space)
      space_id="$2"
      shift 2
      ;;
    --name)
      name="$2"
      shift 2
      ;;
    --parent-id)
      parent_id="$2"
      shift 2
      ;;
    --print-id)
      print_id=1
      shift 1
      ;;
    *)
      if [ -z "${name}" ]; then
        name="$1"
      fi
      shift 1
      ;;
  esac
done

if [ -z "${name}" ]; then
  printf "Missing folder name. Use --name or pass a positional value.\n" >&2
  exit 1
fi

response=$(curl -s -X POST "https://mapi.storyblok.com/v1/spaces/${space_id}/asset_folders" \
  -H "Authorization: ${STORYBLOK_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"asset_folder\":{\"name\":\"${name}\",\"parent_id\":${parent_id}}}")

folder_id=$(printf '%s' "${response}" | node -e 'const fs=require("fs");const data=JSON.parse(fs.readFileSync(0,"utf8"));const folder=data.asset_folder||{};process.stdout.write(String(folder.id||""));')

if [ "${print_id}" -eq 1 ]; then
  printf "%s" "${folder_id}"
  exit 0
fi

if [ -z "${folder_id}" ]; then
  printf "created folder\n"
else
  printf "created folder %s (%s)\n" "${folder_id}" "${name}"
fi
