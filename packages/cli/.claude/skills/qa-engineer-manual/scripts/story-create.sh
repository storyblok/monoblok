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
slug=""
content_file=""

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

if [ -z "${name}" ] || [ -z "${slug}" ]; then
  printf "Missing --name or --slug.\n" >&2
  exit 1
fi

payload=$(node -e 'const fs=require("fs");const name=process.argv[1];const slug=process.argv[2];const contentPath=process.argv[3];let content={};if(contentPath){content=JSON.parse(fs.readFileSync(contentPath,"utf8"));}console.log(JSON.stringify({story:{name,slug,content}}));' "${name}" "${slug}" "${content_file}")

response=$(curl -s -X POST "https://mapi.storyblok.com/v1/spaces/${space_id}/stories" \
  -H "Authorization: ${STORYBLOK_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "${payload}")

story_id=$(printf '%s' "${response}" | node -e 'const fs=require("fs");let data={};try{data=JSON.parse(fs.readFileSync(0,"utf8"));}catch(error){process.stdout.write("");process.exit(0);}const story=data.story||{};process.stdout.write(String(story.id||""));')

if [ -z "${story_id}" ]; then
  printf "failed to create story. response:\n%s\n" "${response}" >&2
  exit 1
fi

printf "created story %s (%s)\n" "${story_id}" "${slug}"
