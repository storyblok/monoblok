#!/usr/bin/env bash
set -euo pipefail

# Called by seed-scenario.sh with: generate.sh <staging_dir> <fake_id>
# Generates 150 asset files (PNG + meta.json sidecar) into the staging directory.

staging_dir="$1"
fake_id="$2"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
template_png="${script_dir}/../../templates/asset-template.png"
template_meta="${script_dir}/../../templates/asset-template.png.meta.json"
target_dir="${staging_dir}/assets/${fake_id}"

mkdir -p "${target_dir}"

for i in $(seq 1 150); do
  cp "${template_png}" "${target_dir}/asset-${i}.png"
  sed "s/{{ID}}/${i}/g" "${template_meta}" > "${target_dir}/asset-${i}.png.meta.json"
done

printf "Generated 150 asset files in %s\n" "${target_dir}"
