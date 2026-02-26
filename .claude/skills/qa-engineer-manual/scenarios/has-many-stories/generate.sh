#!/usr/bin/env bash
set -euo pipefail

# Called by seed-scenario.sh with: generate.sh <staging_dir> <fake_id>
# Generates 150 story JSON files into the staging directory.

staging_dir="$1"
fake_id="$2"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
template="${script_dir}/../../templates/story-template.json"
target_dir="${staging_dir}/stories/${fake_id}"

mkdir -p "${target_dir}"

for i in $(seq 1 150); do
  sed "s/{{ID}}/${i}/g; s/{{UUID}}/${i}/g" "${template}" > "${target_dir}/story-${i}_${i}.json"
done

printf "Generated 150 story files in %s\n" "${target_dir}"
