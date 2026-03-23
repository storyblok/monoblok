#!/usr/bin/env bash
set -euo pipefail

# ==========================================================================
# Seed 50 stories for quick benchmark checks.
#
# Structure (5 folders + 45 stories):
#   Depth 0  top-level-{1..20}                     20 stories
#   Depth 0  section-{1..3}/                         3 folders
#   Depth 1  section-{n}/overview                    3 stories
#   Depth 1  section-{1..2}/category-1/              2 folders
#   Depth 2  section-{n}/category-1/page-{1..11}    22 stories
# ==========================================================================

staging_dir="$1"
fake_id="$2"

target_dir="${staging_dir}/stories/${fake_id}"
mkdir -p "${target_dir}"

id=0

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

emit_story() {
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
    "intro_text": "Quick-check story for ${name}."
  }
}
EOF
}

# --- generate ---------------------------------------------------------------

# Depth 0: 20 top-level stories
for i in $(seq 1 20); do
  emit_story "Top Level ${i}" "top-level-${i}" "top-level-${i}" 0
done

# Depth 0: section-1 folder
emit_folder "Section 1" "section-1" "section-1" 0
section1_id=$id

# Depth 1: section-1 overview
emit_story "Section 1 Overview" "overview" "section-1/overview" "$section1_id"

# Depth 1: category-1 folder inside section-1
emit_folder "Category 1-1" "category-1" "section-1/category-1" "$section1_id"
cat1_id=$id

# Depth 2: 11 pages inside section-1/category-1
for p in $(seq 1 11); do
  emit_story "Page 1-1-${p}" "page-${p}" "section-1/category-1/page-${p}" "$cat1_id"
done

# Depth 0: section-2 folder
emit_folder "Section 2" "section-2" "section-2" 0
section2_id=$id

# Depth 1: section-2 overview
emit_story "Section 2 Overview" "overview" "section-2/overview" "$section2_id"

# Depth 1: category-1 folder inside section-2
emit_folder "Category 2-1" "category-1" "section-2/category-1" "$section2_id"
cat2_id=$id

# Depth 2: 11 pages inside section-2/category-1
for p in $(seq 1 11); do
  emit_story "Page 2-1-${p}" "page-${p}" "section-2/category-1/page-${p}" "$cat2_id"
done

# Depth 0: section-3 folder (no sub-category, just overview)
emit_folder "Section 3" "section-3" "section-3" 0
section3_id=$id

# Depth 1: section-3 overview
emit_story "Section 3 Overview" "overview" "section-3/overview" "$section3_id"

total_files=$(find "${target_dir}" -maxdepth 1 -name '*.json' | wc -l | tr -d ' ')
printf "Seeded %s stories in %s\n" "${total_files}" "${target_dir}"
