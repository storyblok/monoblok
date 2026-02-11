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

slug_prefix="qa-seed"
tmp_dir=".storyblok/tmp"
content_path="${tmp_dir}/qa-seed-folder-page.json"

mkdir -p "${tmp_dir}"

page_component_id=$(curl -s "https://mapi.storyblok.com/v1/spaces/${space_id}/components/?per_page=100" \
  -H "Authorization: ${STORYBLOK_TOKEN}" \
  | node -e 'const fs=require("fs");const data=JSON.parse(fs.readFileSync(0,"utf8"));const component=(data.components||[]).find((item)=>item.name==="page");process.stdout.write(component?String(component.id):"");')

if [ -z "${page_component_id}" ]; then
  printf "Missing 'page' component in space %s. Please create it before seeding stories.\n" "${space_id}" >&2
  exit 1
fi

cat <<'EOF' > "${content_path}"
{
  "component": "page"
}
EOF

printf "Seeding nested story folders into space %s...\n" "${space_id}"

folder_payload=$(node -e 'const name=process.argv[1];const slug=process.argv[2];const parentId=Number(process.argv[3]);const story={name,slug,is_folder:true,parent_id:parentId};console.log(JSON.stringify({story}));' \
  "QA Seed Folder" \
  "${slug_prefix}-folder" \
  "0")

folder_response=$(curl -s -X POST "https://mapi.storyblok.com/v1/spaces/${space_id}/stories" \
  -H "Authorization: ${STORYBLOK_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "${folder_payload}")

folder_id=$(printf '%s' "${folder_response}" | node -e 'const fs=require("fs");let data={};try{data=JSON.parse(fs.readFileSync(0,"utf8"));}catch(error){process.stdout.write("");process.exit(0);}const story=data.story||{};process.stdout.write(String(story.id||""));')

if [ -z "${folder_id}" ]; then
  printf "failed to create story folder. response:\n%s\n" "${folder_response}" >&2
  exit 1
fi

printf "created story folder %s (%s)\n" "${folder_id}" "${slug_prefix}-folder"

nested_payload_a=$(node -e 'const fs=require("fs");const name=process.argv[1];const slug=process.argv[2];const parentId=Number(process.argv[3]);const contentPath=process.argv[4];const story={name,slug,parent_id:parentId};if(contentPath){story.content=JSON.parse(fs.readFileSync(contentPath,"utf8"));}console.log(JSON.stringify({story}));' \
  "QA Seed Nested A" \
  "${slug_prefix}-nested-a" \
  "${folder_id}" \
  "${content_path}")

nested_response_a=$(curl -s -X POST "https://mapi.storyblok.com/v1/spaces/${space_id}/stories" \
  -H "Authorization: ${STORYBLOK_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "${nested_payload_a}")

nested_id_a=$(printf '%s' "${nested_response_a}" | node -e 'const fs=require("fs");let data={};try{data=JSON.parse(fs.readFileSync(0,"utf8"));}catch(error){process.stdout.write("");process.exit(0);}const story=data.story||{};process.stdout.write(String(story.id||""));')

if [ -z "${nested_id_a}" ]; then
  printf "failed to create nested story. response:\n%s\n" "${nested_response_a}" >&2
  exit 1
fi

nested_payload_b=$(node -e 'const fs=require("fs");const name=process.argv[1];const slug=process.argv[2];const parentId=Number(process.argv[3]);const contentPath=process.argv[4];const story={name,slug,parent_id:parentId};if(contentPath){story.content=JSON.parse(fs.readFileSync(contentPath,"utf8"));}console.log(JSON.stringify({story}));' \
  "QA Seed Nested B" \
  "${slug_prefix}-nested-b" \
  "${folder_id}" \
  "${content_path}")

nested_response_b=$(curl -s -X POST "https://mapi.storyblok.com/v1/spaces/${space_id}/stories" \
  -H "Authorization: ${STORYBLOK_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "${nested_payload_b}")

nested_id_b=$(printf '%s' "${nested_response_b}" | node -e 'const fs=require("fs");let data={};try{data=JSON.parse(fs.readFileSync(0,"utf8"));}catch(error){process.stdout.write("");process.exit(0);}const story=data.story||{};process.stdout.write(String(story.id||""));')

if [ -z "${nested_id_b}" ]; then
  printf "failed to create nested story. response:\n%s\n" "${nested_response_b}" >&2
  exit 1
fi

printf "created nested story %s (%s)\n" "${nested_id_a}" "${slug_prefix}-nested-a"
printf "created nested story %s (%s)\n" "${nested_id_b}" "${slug_prefix}-nested-b"
