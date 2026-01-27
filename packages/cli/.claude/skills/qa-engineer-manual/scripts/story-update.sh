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
story_id=""
name=""
slug=""
content_file=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --space)
      space_id="$2"
      shift 2
      ;;
    --id)
      story_id="$2"
      shift 2
      ;;
    --name)
      name="$2"
      shift 2
      ;;
    --slug)
      slug="$2"
      shift 2
      ;;
    --content)
      content_file="$2"
      shift 2
      ;;
    *)
      shift 1
      ;;
  esac
done

if [ -z "${story_id}" ]; then
  printf "Missing --id.\n" >&2
  exit 1
fi

payload=$(node -e 'const fs=require("fs");const id=process.argv[1];const name=process.argv[2];const slug=process.argv[3];const contentPath=process.argv[4];const story={id:Number(id)};if(name){story.name=name;}if(slug){story.slug=slug;}if(contentPath){story.content=JSON.parse(fs.readFileSync(contentPath,"utf8"));}console.log(JSON.stringify({story}));' "${story_id}" "${name}" "${slug}" "${content_file}")

curl -s -X PUT "https://mapi.storyblok.com/v1/spaces/${space_id}/stories/${story_id}" \
  -H "Authorization: ${STORYBLOK_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "${payload}" \
  > /dev/null

printf "updated story %s\n" "${story_id}"
