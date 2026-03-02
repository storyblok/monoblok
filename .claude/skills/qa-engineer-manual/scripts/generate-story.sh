#!/usr/bin/env bash
set -euo pipefail

# Generates a story JSON and writes to stdout.
# All fields are optional — without flags a generic page story is produced.
#
# Usage:
#   bash .claude/skills/qa-engineer-manual/scripts/generate-story.sh
#   bash .claude/skills/qa-engineer-manual/scripts/generate-story.sh \
#     --slug "my-test" --name "My Test" --component page
#   bash .claude/skills/qa-engineer-manual/scripts/generate-story.sh \
#     --slug "child" --parent-id 3 > scenarios/my-scenario/stories/child_99.json

id="${RANDOM}"
uuid=""
name=""
slug=""
full_slug=""
component="page"
parent_id=""
is_folder=false

while [ "$#" -gt 0 ]; do
  case "$1" in
    --id)         id="$2";        shift 2 ;;
    --uuid)       uuid="$2";      shift 2 ;;
    --name)       name="$2";      shift 2 ;;
    --slug)       slug="$2";      shift 2 ;;
    --full-slug)  full_slug="$2"; shift 2 ;;
    --component)  component="$2"; shift 2 ;;
    --parent-id)  parent_id="$2"; shift 2 ;;
    --is-folder)  is_folder=true; shift 1 ;;
    *)            printf "warning: unknown argument '%s'\n" "$1" >&2; shift 1 ;;
  esac
done

if [ -z "${uuid}" ]; then
  uuid="${id}"
fi

if [ -z "${slug}" ]; then
  slug="qa-story-${id}"
fi

if [ -z "${name}" ]; then
  name=$(printf '%s' "${slug}" | tr '-' ' ' | awk '{for(i=1;i<=NF;i++){$i=toupper(substr($i,1,1))substr($i,2)}}1')
fi

if [ -z "${full_slug}" ]; then
  full_slug="${slug}"
fi

node -e '
const id = parseInt(process.argv[1]);
const uuid = process.argv[2];
const name = process.argv[3];
const slug = process.argv[4];
const fullSlug = process.argv[5];
const component = process.argv[6];
const parentId = process.argv[7] ? parseInt(process.argv[7]) : undefined;
const isFolder = process.argv[8] === "true";

const story = { id, uuid, name, slug, full_slug: fullSlug };

if (isFolder) {
  story.is_folder = true;
}

if (parentId !== undefined) {
  story.parent_id = parentId;
}

if (!isFolder) {
  story.content = { component };
}

process.stdout.write(JSON.stringify(story, null, 2) + "\n");
' "${id}" "${uuid}" "${name}" "${slug}" "${full_slug}" "${component}" "${parent_id}" "${is_folder}"
