#!/usr/bin/env bash
set -euo pipefail

# Seeds a Storyblok QA scenario by:
#   1. Copying scenario data from the skill folder into .storyblok/{resource}/qa-engineer-manual/
#   2. Running CLI push commands against the real space
#   3. Cleaning up the staging directory
#
# Requires STORYBLOK_TOKEN loaded from ${PWD}/.env.qa-engineer-manual
#
# Usage:
#   bash .claude/skills/qa-engineer-manual/scripts/seed-scenario.sh --scenario has-stories
#   bash .claude/skills/qa-engineer-manual/scripts/seed-scenario.sh --scenario has-rich-content --scenario-dir /path/to/scenarios
#   bash .claude/skills/qa-engineer-manual/scripts/seed-scenario.sh --scenario has-rich-content --scenario-dir /path/to/scenarios

# shellcheck source=_common.sh
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"
load_env

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
scenario=""
space_id=""
custom_scenarios_dir=""
skip_components=false
skip_datasources=false
skip_assets=false
skip_stories=false
no_clean=false

while [ "$#" -gt 0 ]; do
  case "$1" in
    --scenario)
      scenario="$2"
      shift 2
      ;;
    --space)
      space_id="$2"
      shift 2
      ;;
    --scenario-dir)
      custom_scenarios_dir="$2"
      shift 2
      ;;
    --skip-components)
      skip_components=true
      shift 1
      ;;
    --skip-datasources)
      skip_datasources=true
      shift 1
      ;;
    --skip-assets)
      skip_assets=true
      shift 1
      ;;
    --skip-stories)
      skip_stories=true
      shift 1
      ;;
    --no-clean)
      no_clean=true
      shift 1
      ;;
    *)
      printf "warning: unknown argument '%s'\n" "$1" >&2
      shift 1
      ;;
  esac
done

if [ -z "${scenario}" ]; then
  printf "Missing --scenario <name>.\n" >&2
  printf "Available: has-stories, has-many-stories, has-many-assets\n" >&2
  exit 1
fi

require_space_id

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
FAKE_ID="qa-seed"
repo_root="$(git rev-parse --show-toplevel)"
cli_bin="${repo_root}/packages/cli/dist/index.mjs"
skill_dir="${repo_root}/.claude/skills/qa-engineer-manual"
staging_dir="${repo_root}/.storyblok"

# Resolve scenarios directory: custom (--scenario-dir) or built-in
if [ -n "${custom_scenarios_dir}" ]; then
  scenarios_dir="${custom_scenarios_dir}"
else
  scenarios_dir="${skill_dir}/scenarios"
fi

scenario_dir="${scenarios_dir}/${scenario}"
default_components_dir="${skill_dir}/scenarios/has-default-components"

if [ ! -d "${scenario_dir}" ]; then
  printf "Scenario '%s' not found at %s\n" "${scenario}" "${scenario_dir}" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Clean up remote space before seeding
# ---------------------------------------------------------------------------
if [ "${no_clean}" = false ]; then
  printf "Cleaning space %s ... " "${space_id}"
  cleanup_output=$(bash "${skill_dir}/scripts/cleanup-remote.sh" --space "${space_id}" 2>&1)
  # Extract the result line (last line of output)
  cleanup_result=$(printf '%s' "${cleanup_output}" | tail -1)
  printf "%s\n" "${cleanup_result}"
else
  printf "Skipping cleanup (--no-clean)\n"
fi

# ---------------------------------------------------------------------------
# Cleanup trap — always remove staging data on exit
# ---------------------------------------------------------------------------
cleanup() {
  for resource in components stories assets datasources; do
    rm -rf "${staging_dir}/${resource}/${FAKE_ID}"
  done
  for resource in components stories assets datasources; do
    rmdir "${staging_dir}/${resource}" 2>/dev/null || true
  done
  rmdir "${staging_dir}" 2>/dev/null || true
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Stage scenario data
# ---------------------------------------------------------------------------
printf "Staging scenario '%s' ... " "${scenario}"

staged=()

# Stage default components first (every scenario gets them unless skipped)
if [ "${skip_components}" = false ] && [ -d "${default_components_dir}/components" ]; then
  mkdir -p "${staging_dir}/components/${FAKE_ID}"
  cp -r "${default_components_dir}/components/"* "${staging_dir}/components/${FAKE_ID}/"
fi

# Stage scenario-specific components (override/extend defaults)
if [ "${skip_components}" = false ] && [ -d "${scenario_dir}/components" ]; then
  mkdir -p "${staging_dir}/components/${FAKE_ID}"
  cp -r "${scenario_dir}/components/"* "${staging_dir}/components/${FAKE_ID}/"
fi

# Stage scenario-specific data: either run generate.sh or copy static files
if [ -f "${scenario_dir}/generate.sh" ]; then
  bash "${scenario_dir}/generate.sh" "${staging_dir}" "${FAKE_ID}"
else
  for resource in stories assets datasources; do
    if [ -d "${scenario_dir}/${resource}" ]; then
      mkdir -p "${staging_dir}/${resource}/${FAKE_ID}"
      cp -r "${scenario_dir}/${resource}/"* "${staging_dir}/${resource}/${FAKE_ID}/"
    fi
  done
fi

# Build staged summary
for resource in components stories assets datasources; do
  dir="${staging_dir}/${resource}/${FAKE_ID}"
  if [ -d "${dir}" ]; then
    count=$(find "${dir}" -maxdepth 1 -type f -name '*.json' | wc -l | tr -d ' ')
    if [ "${resource}" = "assets" ]; then
      count=$(find "${dir}" -maxdepth 1 -type f ! -name '*.json' ! -name '*.jsonl' | wc -l | tr -d ' ')
    fi
    if [ "${count}" -gt 0 ]; then
      staged+=("${count} ${resource}")
    fi
  fi
done

staged_str=""
for s in "${staged[@]}"; do
  staged_str="${staged_str:+${staged_str}, }${s}"
done
printf "%s\n" "${staged_str}"

# ---------------------------------------------------------------------------
# CLI login
# ---------------------------------------------------------------------------
node "${cli_bin}" login --token "${STORYBLOK_TOKEN}" --region eu > /dev/null 2>&1

# ---------------------------------------------------------------------------
# Push resources in dependency order
# ---------------------------------------------------------------------------

# 1. Components
if [ "${skip_components}" = false ] && [ -d "${staging_dir}/components/${FAKE_ID}" ]; then
  printf "Pushing components ... "
  node "${cli_bin}" components push --from "${FAKE_ID}" --space "${space_id}" --separate-files > /dev/null 2>&1
  printf "done\n"
fi

# 2. Datasources + Assets in parallel (both independent)
bg_pids=()
bg_labels=()

if [ "${skip_datasources}" = false ] && [ -d "${staging_dir}/datasources/${FAKE_ID}" ]; then
  node "${cli_bin}" datasources push --from "${FAKE_ID}" --space "${space_id}" --separate-files > /dev/null 2>&1 &
  bg_pids+=($!)
  bg_labels+=("datasources")
fi

if [ "${skip_assets}" = false ] && [ -d "${staging_dir}/assets/${FAKE_ID}" ]; then
  node "${cli_bin}" assets push --from "${FAKE_ID}" --space "${space_id}" > /dev/null 2>&1 &
  bg_pids+=($!)
  bg_labels+=("assets")
fi

if [ "${#bg_pids[@]}" -gt 0 ]; then
  bg_label_str=""
  for l in "${bg_labels[@]}"; do
    bg_label_str="${bg_label_str:+${bg_label_str}, }${l}"
  done
  printf "Pushing %s ... " "${bg_label_str}"
  # Kill remaining background processes on failure to avoid orphans
  trap 'for p in "${bg_pids[@]}"; do kill "${p}" 2>/dev/null || true; done; cleanup' ERR
  wait "${bg_pids[@]}"
  trap cleanup EXIT
  printf "done\n"
fi

# 3. Stories (reads asset manifest.jsonl for ID remapping automatically)
if [ "${skip_stories}" = false ] && [ -d "${staging_dir}/stories/${FAKE_ID}" ]; then
  printf "Pushing stories ... "
  node "${cli_bin}" stories push --from "${FAKE_ID}" --space "${space_id}" > /dev/null 2>&1
  printf "done\n"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
pushed_summary=""
for resource in components stories assets datasources; do
  skip_var="skip_${resource}"
  if [ "${!skip_var}" = true ]; then
    continue
  fi
  dir="${staging_dir}/${resource}/${FAKE_ID}"
  if [ -d "${dir}" ]; then
    count=$(find "${dir}" -maxdepth 1 -type f -name '*.json' | wc -l | tr -d ' ')
    if [ "${resource}" = "assets" ]; then
      count=$(find "${dir}" -maxdepth 1 -type f ! -name '*.json' ! -name '*.jsonl' | wc -l | tr -d ' ')
    fi
    if [ "${count}" -gt 0 ]; then
      pushed_summary="${pushed_summary:+${pushed_summary}, }${count} ${resource}"
    fi
  fi
done

if [ -n "${pushed_summary}" ]; then
  printf "Seeded: %s into space %s\n" "${pushed_summary}" "${space_id}"
else
  printf "Seeded scenario '%s' into space %s\n" "${scenario}" "${space_id}"
fi
