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
display_name=""
schema_file=""
is_root=0

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
    --display-name)
      display_name="$2"
      shift 2
      ;;
    --schema)
      schema_file="$2"
      shift 2
      ;;
    --is-root)
      is_root=1
      shift 1
      ;;
    *)
      shift 1
      ;;
  esac
done

if [ -z "${name}" ]; then
  printf "Missing --name.\n" >&2
  exit 1
fi

payload=$(node -e 'const fs=require("fs");const name=process.argv[1];const displayName=process.argv[2]||name;const schemaPath=process.argv[3];const isRoot=process.argv[4]==="1";let schema={};if(schemaPath){schema=JSON.parse(fs.readFileSync(schemaPath,"utf8"));}const component={name,display_name:displayName,schema};if(isRoot){component.is_root=true;}console.log(JSON.stringify({component}));' "${name}" "${display_name}" "${schema_file}" "${is_root}")

response=$(curl -s -X POST "https://mapi.storyblok.com/v1/spaces/${space_id}/components" \
  -H "Authorization: ${STORYBLOK_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "${payload}")

component_id=$(printf '%s' "${response}" | node -e 'const fs=require("fs");let data={};try{data=JSON.parse(fs.readFileSync(0,"utf8"));}catch(error){process.stdout.write("");process.exit(0);}const component=data.component||{};process.stdout.write(String(component.id||""));')

if [ -z "${component_id}" ]; then
  printf "failed to create component. response:\n%s\n" "${response}" >&2
  exit 1
fi

printf "created component %s (%s)\n" "${component_id}" "${name}"
