#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=_common.sh
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"
load_env

removed=0

# Collect space IDs that are actually set
space_ids=()
[ -n "${STORYBLOK_SPACE_ID:-}" ] && space_ids+=("${STORYBLOK_SPACE_ID}")
[ -n "${STORYBLOK_SPACE_ID_TARGET:-}" ] && space_ids+=("${STORYBLOK_SPACE_ID_TARGET}")

if [ "${#space_ids[@]}" -eq 0 ]; then
  printf "No STORYBLOK_SPACE_ID or STORYBLOK_SPACE_ID_TARGET set — nothing to clean.\n"
  exit 0
fi

# Clean up pulled stories, assets, components, datasources
for sid in "${space_ids[@]}"; do
  for resource in stories assets components datasources; do
    dir=".storyblok/${resource}/${sid}"
    if [ -d "${dir}" ]; then
      rm -rf "${dir}"
      removed=$((removed + 1))
    fi
  done
done

if [ "${removed}" -eq 0 ]; then
  printf "clean\n"
else
  printf "removed %s directories\n" "${removed}"
fi
