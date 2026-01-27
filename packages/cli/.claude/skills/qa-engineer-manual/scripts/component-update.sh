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
component_id=""
name=""
display_name=""
schema_file=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --space)
      space_id="$2"
      shift 2
      ;;
    --id)
      component_id="$2"
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
    *)
      shift 1
      ;;
  esac
done

if [ -z "${component_id}" ]; then
  printf "Missing --id.\n" >&2
  exit 1
fi

payload=$(node -e 'const fs=require("fs");const id=process.argv[1];const name=process.argv[2];const displayName=process.argv[3];const schemaPath=process.argv[4];const component={id:Number(id)};if(name){component.name=name;}if(displayName){component.display_name=displayName;}if(schemaPath){component.schema=JSON.parse(fs.readFileSync(schemaPath,"utf8"));}console.log(JSON.stringify({component}));' "${component_id}" "${name}" "${display_name}" "${schema_file}")

curl -s -X PUT "https://mapi.storyblok.com/v1/spaces/${space_id}/components/${component_id}" \
  -H "Authorization: ${STORYBLOK_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "${payload}" \
  > /dev/null

printf "updated component %s\n" "${component_id}"
