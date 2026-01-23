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
content_path="${tmp_dir}/qa-seed-page.json"

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

printf "Seeding 3 basic stories into space %s...\n" "${space_id}"
./.claude/skills/qa-engineer-manual/scripts/story-create.sh \
  --space "${space_id}" \
  --name "QA Seed Home" \
  --slug "${slug_prefix}-home" \
  --content "${content_path}"

./.claude/skills/qa-engineer-manual/scripts/story-create.sh \
  --space "${space_id}" \
  --name "QA Seed About" \
  --slug "${slug_prefix}-about" \
  --content "${content_path}"

./.claude/skills/qa-engineer-manual/scripts/story-create.sh \
  --space "${space_id}" \
  --name "QA Seed Blog" \
  --slug "${slug_prefix}-blog" \
  --content "${content_path}"
