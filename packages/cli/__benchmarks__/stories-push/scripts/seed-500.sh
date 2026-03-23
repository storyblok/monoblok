#!/usr/bin/env bash
set -euo pipefail

# ==========================================================================
# Seed 500 stories for benchmarking.
#
# Structure (25 folders + 475 stories):
#   Depth 0  top-level-{1..50}                                   50 stories
#   Depth 0  section-{1..5}/                                      5 folders
#   Depth 1  section-{n}/overview                                  5 stories
#   Depth 1  section-{n}/category-{1..4}/                         20 folders
#   Depth 2  section-{n}/category-{m}/page-{1..20}              400 stories
#   Depth 2  section-{n}/category-{m}/deep-{1}                   20 stories
#
# Content variety: ~30% minimal, ~50% medium, ~20% rich
# ==========================================================================

staging_dir="$1"
fake_id="$2"

target_dir="${staging_dir}/stories/${fake_id}"
mkdir -p "${target_dir}"

id=0

# --- emitters ---------------------------------------------------------------

emit_folder() {
  local name="$1" slug="$2" full_slug="$3" parent_id="$4"
  id=$((id + 1))
  local pf=""
  if [ "$parent_id" -gt 0 ]; then
    pf=$(printf '  "parent_id": %d,\n' "$parent_id")
  fi
  cat > "${target_dir}/${slug}_${id}.json" <<EOF
{
  "id": ${id},
  "uuid": "${id}",
  "name": "${name}",
  "slug": "${slug}",
  "full_slug": "${full_slug}",
  ${pf}"is_folder": true,
  "content": {
    "component": "page",
    "headline": "${name}"
  }
}
EOF
}

emit_minimal_story() {
  local name="$1" slug="$2" full_slug="$3" parent_id="$4"
  id=$((id + 1))
  local pf=""
  if [ "$parent_id" -gt 0 ]; then
    pf=$(printf '  "parent_id": %d,\n' "$parent_id")
  fi
  cat > "${target_dir}/${slug}_${id}.json" <<EOF
{
  "id": ${id},
  "uuid": "${id}",
  "name": "${name}",
  "slug": "${slug}",
  "full_slug": "${full_slug}",
  ${pf}"content": {
    "component": "page"
  }
}
EOF
}

emit_medium_story() {
  local name="$1" slug="$2" full_slug="$3" parent_id="$4"
  id=$((id + 1))
  local pf=""
  if [ "$parent_id" -gt 0 ]; then
    pf=$(printf '  "parent_id": %d,\n' "$parent_id")
  fi
  cat > "${target_dir}/${slug}_${id}.json" <<EOF
{
  "id": ${id},
  "uuid": "${id}",
  "name": "${name}",
  "slug": "${slug}",
  "full_slug": "${full_slug}",
  ${pf}"content": {
    "component": "page",
    "headline": "${name}",
    "hero_image": {
      "id": ${id},
      "fieldtype": "asset",
      "filename": "https://a.storyblok.com/f/000000/${id}/placeholder.png",
      "alt": "Placeholder for ${name}"
    },
    "seo_description": "Benchmark page: ${full_slug}",
    "intro_text": "This is the introduction text for ${name}. It is a medium complexity story used in benchmarking the story push pipeline."
  }
}
EOF
}

emit_rich_story() {
  local name="$1" slug="$2" full_slug="$3" parent_id="$4" link_uuid="$5"
  id=$((id + 1))
  local pf=""
  if [ "$parent_id" -gt 0 ]; then
    pf=$(printf '  "parent_id": %d,\n' "$parent_id")
  fi
  cat > "${target_dir}/${slug}_${id}.json" <<EOF
{
  "id": ${id},
  "uuid": "${id}",
  "name": "${name}",
  "slug": "${slug}",
  "full_slug": "${full_slug}",
  ${pf}"content": {
    "component": "page",
    "headline": "${name}",
    "hero_image": {
      "id": ${id},
      "fieldtype": "asset",
      "filename": "https://a.storyblok.com/f/000000/${id}/placeholder.png",
      "alt": "Rich content image"
    },
    "body": {
      "type": "doc",
      "content": [
        {
          "type": "paragraph",
          "content": [
            { "text": "This is rich content for ", "type": "text" },
            { "text": "${name}", "type": "text", "marks": [{ "type": "bold" }] },
            { "text": " with a ", "type": "text" },
            {
              "text": "story link",
              "type": "text",
              "marks": [{
                "type": "link",
                "attrs": {
                  "href": "/",
                  "uuid": "${link_uuid}",
                  "target": "_self",
                  "linktype": "story"
                }
              }]
            }
          ]
        },
        {
          "type": "heading",
          "attrs": { "level": 2 },
          "content": [{ "text": "Section heading", "type": "text" }]
        },
        {
          "type": "paragraph",
          "content": [{ "text": "Additional paragraph for content depth in benchmark testing.", "type": "text" }]
        }
      ]
    },
    "blocks": [
      { "_uid": "blok-${id}-1", "component": "page", "headline": "Nested block 1" },
      { "_uid": "blok-${id}-2", "component": "page", "headline": "Nested block 2" }
    ],
    "seo_description": "Rich benchmark page: ${full_slug}",
    "intro_text": "Rich content story for benchmarking with richtext, blocks, and cross-references."
  }
}
EOF
}

emit_story() {
  local name="$1" slug="$2" full_slug="$3" parent_id="$4" index="$5"
  local bucket=$((index % 10))
  if [ "$bucket" -lt 3 ]; then
    emit_minimal_story "$name" "$slug" "$full_slug" "$parent_id"
  elif [ "$bucket" -lt 8 ]; then
    emit_medium_story "$name" "$slug" "$full_slug" "$parent_id"
  else
    emit_rich_story "$name" "$slug" "$full_slug" "$parent_id" "1"
  fi
}

# --- generate ---------------------------------------------------------------

story_index=0

# Depth 0: 50 top-level stories
for i in $(seq 1 50); do
  story_index=$((story_index + 1))
  emit_story "Top Level ${i}" "top-level-${i}" "top-level-${i}" 0 "$story_index"
done

# 5 sections x 4 categories
for s in $(seq 1 5); do
  emit_folder "Section ${s}" "section-${s}" "section-${s}" 0
  section_id=$id

  story_index=$((story_index + 1))
  emit_story "Section ${s} Overview" "overview" "section-${s}/overview" "$section_id" "$story_index"

  for c in $(seq 1 4); do
    emit_folder "Category ${s}-${c}" "category-${c}" "section-${s}/category-${c}" "$section_id"
    cat_id=$id

    for p in $(seq 1 20); do
      story_index=$((story_index + 1))
      emit_story "Page ${s}-${c}-${p}" "page-${p}" "section-${s}/category-${c}/page-${p}" "$cat_id" "$story_index"
    done

    story_index=$((story_index + 1))
    emit_story "Deep ${s}-${c}-1" "deep-1" "section-${s}/category-${c}/deep-1" "$cat_id" "$story_index"
  done
done

total_files=$(find "${target_dir}" -maxdepth 1 -name '*.json' | wc -l | tr -d ' ')
printf "Seeded %s stories in %s\n" "${total_files}" "${target_dir}"
