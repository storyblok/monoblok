#!/usr/bin/env bash
# Appends the component's remote schema to the report notes (not visible to the judge).
set -uo pipefail
component="$1"
out="$(mktemp -d)"
{
  echo "## \`${component}\` schema in space ${STORYBLOK_SPACE_ID} after run"
  echo '```json'
  if storyblok components pull "${component}" --space "${STORYBLOK_SPACE_ID}" --path "${out}" >/dev/null 2>&1; then
    grep -rl "\"name\": \"${component}\"" "${out}" | xargs cat
  else
    echo "pull failed"
  fi
  echo '```'
} >>"${AXIS_OUTPUT}"
