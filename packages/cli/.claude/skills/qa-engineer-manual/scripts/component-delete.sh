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
    *)
      if [ -z "${component_id}" ]; then
        component_id="$1"
      fi
      shift 1
      ;;
  esac
done

if [ -z "${component_id}" ]; then
  printf "Missing --id.\n" >&2
  exit 1
fi

curl -s -X DELETE "https://mapi.storyblok.com/v1/spaces/${space_id}/components/${component_id}" \
  -H "Authorization: ${STORYBLOK_TOKEN}" \
  > /dev/null

printf "deleted component %s\n" "${component_id}"
