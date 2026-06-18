#!/usr/bin/env bash
set -euo pipefail

# Seeds a Storyblok QA scenario by:
#   1. Copying scenario data from the skill folder into .storyblok/{resource}/qa-engineer-manual/
#   2. Running CLI push commands against the real space (failures surface and abort)
#   3. Verifying the staged resources actually landed remotely
#   4. Cleaning up the staging directory
#
# Each push is checked for success and the seeded counts are verified against the
# space afterwards, so a push that errors (or silently creates nothing) fails the
# seed loudly rather than reporting phantom success.
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
# Helpers
# ---------------------------------------------------------------------------

# Counts staged files for a resource (assets are the non-JSON files; every
# other resource is one *.json per entity).
count_staged() {
  local resource="$1"
  local dir="${staging_dir}/${resource}/${FAKE_ID}"
  if [ ! -d "${dir}" ]; then
    printf "0"
    return
  fi
  if [ "${resource}" = "assets" ]; then
    find "${dir}" -maxdepth 1 -type f ! -name '*.json' ! -name '*.jsonl' | wc -l | tr -d ' '
  else
    find "${dir}" -maxdepth 1 -type f -name '*.json' | wc -l | tr -d ' '
  fi
}

# Runs a CLI push, capturing output and retrying once on failure. Prints "done"
# only on real success; on failure it prints the captured CLI output and exits
# non-zero, so the seed can never report phantom success for a push that
# actually errored (previously output was sent to /dev/null and "done" printed
# unconditionally).
run_push() {
  local label="$1"; shift
  local attempts=2 attempt=1 status=0 out=""
  printf "Pushing %s ... " "${label}"
  while [ "${attempt}" -le "${attempts}" ]; do
    out=$("$@" 2>&1) && { printf "done\n"; return 0; }
    status=$?
    attempt=$((attempt + 1))
    if [ "${attempt}" -le "${attempts}" ]; then sleep 2; fi
  done
  printf "FAILED\n"
  printf "%s push failed after %s attempt(s) (exit %s):\n" "${label}" "${attempts}" "${status}" >&2
  printf '%s\n' "${out}" | sed 's/^/  | /' >&2
  exit 1
}

# Asserts a resource actually landed remotely. Catches pushes that exit 0 but
# create nothing (e.g. stories pushed against missing components): the remote
# count must be at least the staged count. Retries briefly to absorb
# read-after-write propagation lag.
verify_seeded() {
  local resource="$1" expected="$2" actual="" attempt=1
  while [ "${attempt}" -le 3 ]; do
    actual=$(bash "${skill_dir}/scripts/list.sh" --resource "${resource}" --space "${space_id}" 2>/dev/null | tail -1 | awk '{print $1}') || actual=""
    if [[ "${actual}" =~ ^[0-9]+$ ]] && [ "${actual}" -ge "${expected}" ]; then
      return 0
    fi
    attempt=$((attempt + 1))
    if [ "${attempt}" -le 3 ]; then sleep 2; fi
  done
  printf "Verification FAILED: staged %s %s but found '%s' remotely after retries — the push reported success but data did not land.\n" "${expected}" "${resource}" "${actual}" >&2
  exit 1
}

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
  count="$(count_staged "${resource}")"
  if [ "${count}" -gt 0 ]; then
    staged+=("${count} ${resource}")
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
if ! login_out=$(node "${cli_bin}" login --token "${STORYBLOK_TOKEN}" --region eu 2>&1); then
  printf "CLI login failed:\n" >&2
  printf '%s\n' "${login_out}" | sed 's/^/  | /' >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Push resources in dependency order
#
# Pushed sequentially (not in parallel): each push is verified to have actually
# succeeded before the next runs, and assets must land before stories — stories
# remap asset IDs from the asset manifest. run_push surfaces failures instead of
# swallowing them.
# ---------------------------------------------------------------------------

# 1. Components
if [ "${skip_components}" = false ] && [ -d "${staging_dir}/components/${FAKE_ID}" ]; then
  run_push "components" node "${cli_bin}" components push --from "${FAKE_ID}" --space "${space_id}" --separate-files
fi

# 2. Datasources
if [ "${skip_datasources}" = false ] && [ -d "${staging_dir}/datasources/${FAKE_ID}" ]; then
  run_push "datasources" node "${cli_bin}" datasources push --from "${FAKE_ID}" --space "${space_id}" --separate-files
fi

# 3. Assets (must precede stories)
if [ "${skip_assets}" = false ] && [ -d "${staging_dir}/assets/${FAKE_ID}" ]; then
  run_push "assets" node "${cli_bin}" assets push --from "${FAKE_ID}" --space "${space_id}"
fi

# 4. Stories (reads asset manifest.jsonl for ID remapping automatically)
if [ "${skip_stories}" = false ] && [ -d "${staging_dir}/stories/${FAKE_ID}" ]; then
  run_push "stories" node "${cli_bin}" stories push --from "${FAKE_ID}" --space "${space_id}"
fi

# ---------------------------------------------------------------------------
# Verify what we staged actually landed remotely
# ---------------------------------------------------------------------------
for resource in components stories assets datasources; do
  skip_var="skip_${resource}"
  if [ "${!skip_var}" = true ]; then
    continue
  fi
  expected="$(count_staged "${resource}")"
  if [ "${expected}" -gt 0 ]; then
    verify_seeded "${resource}" "${expected}"
  fi
done

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
pushed_summary=""
for resource in components stories assets datasources; do
  skip_var="skip_${resource}"
  if [ "${!skip_var}" = true ]; then
    continue
  fi
  count="$(count_staged "${resource}")"
  if [ "${count}" -gt 0 ]; then
    pushed_summary="${pushed_summary:+${pushed_summary}, }${count} ${resource}"
  fi
done

if [ -n "${pushed_summary}" ]; then
  printf "Seeded: %s into space %s\n" "${pushed_summary}" "${space_id}"
else
  printf "Seeded scenario '%s' into space %s\n" "${scenario}" "${space_id}"
fi
