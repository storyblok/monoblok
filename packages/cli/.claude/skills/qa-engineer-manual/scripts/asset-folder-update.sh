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
folder_id=""
name=""
parent_id=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --space)
      space_id="$2"
      shift 2
      ;;
    --id)
      folder_id="$2"
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
    *)
      shift 1
      ;;
  esac
done

if [ -z "${folder_id}" ]; then
  printf "Missing folder id. Use --id <folderId>.\n" >&2
  exit 1
fi

if [ -z "${name}" ] && [ -z "${parent_id}" ]; then
  printf "Provide --name or --parent-id.\n" >&2
  exit 1
fi

payload=$(node -e 'const id=process.argv[1];const name=process.argv[2];const parent=process.argv[3];const folder={id:Number(id)};if(name){folder.name=name;}if(parent!==""){folder.parent_id=Number(parent);}console.log(JSON.stringify({asset_folder:folder}));' "${folder_id}" "${name}" "${parent_id}")

curl -s -X PUT "https://mapi.storyblok.com/v1/spaces/${space_id}/asset_folders/${folder_id}" \
  -H "Authorization: ${STORYBLOK_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "${payload}" \
  > /dev/null

printf "updated folder %s\n" "${folder_id}"
