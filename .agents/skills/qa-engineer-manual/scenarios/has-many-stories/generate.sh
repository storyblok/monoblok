#!/usr/bin/env bash
set -euo pipefail

# Called by seed-scenario.sh with: generate.sh <staging_dir> <fake_id>
# Generates 150 story/folder JSON files with a deeply nested folder hierarchy.
#
# Structure (mirrored for locales en-us and de-de):
#
#   Depth 0  <locale>/                                       folder
#   Depth 1  <locale>/home                                   story
#   Depth 1  <locale>/about                                  story
#   Depth 1  <locale>/contact                                story
#   Depth 1  <locale>/blog/                                  folder
#   Depth 1  <locale>/docs/                                  folder
#   Depth 2  <locale>/blog/post-{1..42}                      stories (x42)
#   Depth 2  <locale>/docs/overview                          story
#   Depth 2  <locale>/docs/api/                              folder
#   Depth 2  <locale>/docs/guides/                           folder
#   Depth 3  <locale>/docs/api/endpoint-{1..10}              stories (x10)
#   Depth 3  <locale>/docs/guides/tutorial-{1..10}           stories (x10)
#   Depth 3  <locale>/docs/guides/getting-started/           folder
#   Depth 4  <locale>/docs/guides/getting-started/intro      story
#   Depth 4  <locale>/docs/guides/getting-started/quickstart story
#   Depth 4  <locale>/docs/guides/getting-started/faq        story
#
# Per locale: 6 folders + 69 stories = 75 entries
# Total: 12 folders + 138 stories = 150 entries
#
# Exercises level-by-level placeholder creation:
# - Deep nesting (4 levels) requiring correct topological ordering
# - Duplicate slugs under different parents (en-us/home vs de-de/home)
# - Folders must exist before their children can reference parent_id

staging_dir="$1"
fake_id="$2"

target_dir="${staging_dir}/stories/${fake_id}"
mkdir -p "${target_dir}"

id=0

# emit_folder <name> <slug> <full_slug> <parent_id>
# Writes a folder JSON file. parent_id=0 means no parent.
# Sets global $id to the new entry's ID.
emit_folder() {
  local name="$1" slug="$2" full_slug="$3" parent_id="$4"
  id=$((id + 1))
  local pf=""
  if [ "$parent_id" -gt 0 ]; then
    pf=$(printf '\n  "parent_id": %d,' "$parent_id")
  fi
  cat > "${target_dir}/${slug}_${id}.json" <<EOF
{
  "id": ${id},
  "uuid": "${id}",
  "name": "${name}",
  "slug": "${slug}",
  "full_slug": "${full_slug}",${pf}
  "is_folder": true,
  "content": {
    "component": "page",
    "headline": "${name}",
    "seo_description": "Folder: ${full_slug}"
  }
}
EOF
}

# emit_story <name> <slug> <full_slug> <parent_id>
# Writes a story JSON file. parent_id=0 means no parent.
# Sets global $id to the new entry's ID.
emit_story() {
  local name="$1" slug="$2" full_slug="$3" parent_id="$4"
  id=$((id + 1))
  local pf=""
  if [ "$parent_id" -gt 0 ]; then
    pf=$(printf '\n  "parent_id": %d,' "$parent_id")
  fi
  cat > "${target_dir}/${slug}_${id}.json" <<EOF
{
  "id": ${id},
  "uuid": "${id}",
  "name": "${name}",
  "slug": "${slug}",
  "full_slug": "${full_slug}",${pf}
  "content": {
    "component": "page",
    "headline": "${name}",
    "hero_image": {
      "id": 1,
      "fieldtype": "asset",
      "filename": "https://placeholder.example.com/hero.png",
      "alt": "Placeholder"
    },
    "seo_description": "Auto-generated: ${full_slug}"
  }
}
EOF
}

for locale in en-us de-de; do
  # --- Depth 0 ---
  emit_folder "${locale}" "${locale}" "${locale}" 0
  locale_id=$id

  # --- Depth 1: stories ---
  for page in home about contact; do
    emit_story "${page}" "${page}" "${locale}/${page}" "$locale_id"
  done

  # --- Depth 1: folders ---
  emit_folder "Blog" "blog" "${locale}/blog" "$locale_id"
  blog_id=$id

  emit_folder "Docs" "docs" "${locale}/docs" "$locale_id"
  docs_id=$id

  # --- Depth 2: blog posts ---
  for i in $(seq 1 42); do
    emit_story "Post ${i}" "post-${i}" "${locale}/blog/post-${i}" "$blog_id"
  done

  # --- Depth 2: docs overview ---
  emit_story "Overview" "overview" "${locale}/docs/overview" "$docs_id"

  # --- Depth 2: docs subfolders ---
  emit_folder "API Reference" "api" "${locale}/docs/api" "$docs_id"
  api_id=$id

  emit_folder "Guides" "guides" "${locale}/docs/guides" "$docs_id"
  guides_id=$id

  # --- Depth 3: api endpoints ---
  for i in $(seq 1 10); do
    emit_story "Endpoint ${i}" "endpoint-${i}" "${locale}/docs/api/endpoint-${i}" "$api_id"
  done

  # --- Depth 3: guide tutorials ---
  for i in $(seq 1 10); do
    emit_story "Tutorial ${i}" "tutorial-${i}" "${locale}/docs/guides/tutorial-${i}" "$guides_id"
  done

  # --- Depth 3: getting-started folder ---
  emit_folder "Getting Started" "getting-started" "${locale}/docs/guides/getting-started" "$guides_id"
  gs_id=$id

  # --- Depth 4: getting-started stories ---
  for page in intro quickstart faq; do
    emit_story "${page}" "${page}" "${locale}/docs/guides/getting-started/${page}" "$gs_id"
  done
done

printf "Generated %d files (12 folders + 138 stories) in %s\n" "$id" "${target_dir}"
