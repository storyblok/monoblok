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
size="600x400"
filename=""
folder_id=""
is_private=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --space)
      space_id="$2"
      shift 2
      ;;
    --size)
      size="$2"
      shift 2
      ;;
    --filename)
      filename="$2"
      shift 2
      ;;
    --folder-id)
      folder_id="$2"
      shift 2
      ;;
    --private)
      is_private=1
      shift 1
      ;;
    *)
      if [ -z "${size}" ] || [ "${size}" = "600x400" ]; then
        size="$1"
      elif [ -z "${filename}" ]; then
        filename="$1"
      fi
      shift 1
      ;;
  esac
done

if [ -z "${filename}" ]; then
  filename="placeholder-${size}.png"
fi

tmp_dir=".storyblok/tmp"
tmp_path="${tmp_dir}/${filename}"

mkdir -p "${tmp_dir}"

curl -L "https://placeholdit.com/${size}/dddddd/999999" -o "${tmp_path}"

payload=$(node -e 'const filename=process.argv[1];const size=process.argv[2];const folderId=process.argv[3];const isPrivate=process.argv[4];const data={filename,size,validate_upload:1};if(folderId){data.asset_folder_id=Number(folderId);}if(isPrivate==="1"){data.is_private=1;}console.log(JSON.stringify(data));' "${filename}" "${size}" "${folder_id}" "${is_private}")

signed_response=$(curl -s -X POST "https://mapi.storyblok.com/v1/spaces/${space_id}/assets" \
  -H "Authorization: ${STORYBLOK_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "${payload}")

signed_id=$(printf '%s' "${signed_response}" | node -e 'const fs=require("fs");const data=JSON.parse(fs.readFileSync(0,"utf8"));const id=data.id||"";if(!id){process.exit(1);}process.stdout.write(String(id));')
post_url=$(printf '%s' "${signed_response}" | node -e 'const fs=require("fs");const data=JSON.parse(fs.readFileSync(0,"utf8"));const url=data.post_url||"";if(!url){process.exit(1);}process.stdout.write(String(url));')

form_fields=()
while IFS= read -r entry; do
  form_fields+=("-F" "${entry}")
done < <(printf '%s' "${signed_response}" | node -e 'const fs=require("fs");const data=JSON.parse(fs.readFileSync(0,"utf8"));const fields=data.fields||{};const entries=Object.entries(fields);if(entries.length===0){process.exit(1);}for(const [key,value] of entries){if(value===undefined||value===null||value===""){process.exit(1);}console.log(`${key}=${value}`);}');

if [ "${#form_fields[@]}" -eq 0 ]; then
  printf "failed to parse signed asset fields\n" >&2
  exit 1
fi

curl -sSf -X POST "${post_url}" \
  "${form_fields[@]}" \
  -F "file=@${tmp_path}" \
  > /dev/null

finish_response=$(curl -s -X GET "https://mapi.storyblok.com/v1/spaces/${space_id}/assets/${signed_id}/finish_upload" \
  -H "Authorization: ${STORYBLOK_TOKEN}")

asset_id=$(printf '%s' "${finish_response}" | node -e 'const fs=require("fs");const data=JSON.parse(fs.readFileSync(0,"utf8"));const asset=data.asset||data;const id=asset&&asset.id?asset.id:"";process.stdout.write(String(id));')

if [ -z "${asset_id}" ]; then
  printf "created asset\n"
  exit 0
fi

printf "created asset %s (%s)\n" "${asset_id}" "${filename}"
