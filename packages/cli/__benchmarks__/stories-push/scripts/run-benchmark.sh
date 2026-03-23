#!/usr/bin/env bash
set -euo pipefail

# ==========================================================================
# Story Push Benchmark Runner
#
# Runs the CLI `stories push` command against a real Storyblok space,
# measures wall-clock time for create and update passes, and collects
# results across multiple runs.
#
# Prerequisites:
#   - CLI built: pnpm nx build storyblok
#   - .env.qa-engineer-manual in repo root with STORYBLOK_TOKEN and
#     STORYBLOK_SPACE_ID
#
# Usage:
#   pnpm benchmark:stories-push
#   pnpm benchmark:stories-push --label my-experiment
#   pnpm benchmark:stories-push --quick                 # 50 stories, 2 runs
#   pnpm benchmark:stories-push --runs 3
#   pnpm benchmark:stories-push --compare results/baseline.json
# ==========================================================================

# ---------------------------------------------------------------------------
# Load environment
# ---------------------------------------------------------------------------
repo_root="$(git rev-parse --show-toplevel)"
env_file="${repo_root}/.env.qa-engineer-manual"

if [ -f "${env_file}" ]; then
  set -a
  # shellcheck source=/dev/null
  source "${env_file}"
  set +a
fi

: "${STORYBLOK_TOKEN:?Missing STORYBLOK_TOKEN in ${env_file}}"
: "${STORYBLOK_SPACE_ID:?Missing STORYBLOK_SPACE_ID in ${env_file}}"

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
cli_bin="${repo_root}/packages/cli/dist/index.mjs"
skill_dir="${repo_root}/.claude/skills/qa-engineer-manual"
bench_dir="${repo_root}/packages/cli/__benchmarks__/stories-push"
results_dir="${bench_dir}/results"
staging_dir="${repo_root}/.storyblok"
FAKE_ID="bench-seed"

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
runs=2
quick=false
space_id="${STORYBLOK_SPACE_ID}"
label=""
compare=""

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
while [ "$#" -gt 0 ]; do
  case "$1" in
    --runs)         runs="$2";        shift 2 ;;
    --quick)        quick=true;       shift 1 ;;
    --space)        space_id="$2";    shift 2 ;;
    --label)        label="$2";       shift 2 ;;
    --compare)      compare="$2";     shift 2 ;;
    *)
      printf "warning: unknown argument '%s'\n" "$1" >&2
      shift 1
      ;;
  esac
done

# Resolve seed script and story count based on mode
if [ "${quick}" = true ]; then
  seed_script="${bench_dir}/scripts/seed-50.sh"
  story_count=50
  if [ -z "${label}" ]; then
    label="quick-50stories"
  fi
else
  seed_script="${bench_dir}/scripts/seed-500.sh"
  story_count=500
  if [ -z "${label}" ]; then
    label="bench-500stories"
  fi
fi

mkdir -p "${results_dir}"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Portable high-resolution timestamp in milliseconds
now_ms() {
  if command -v gdate &>/dev/null; then
    gdate +%s%3N
  else
    _ts=$(date +%s%3N 2>/dev/null)
    if [[ "${_ts}" =~ ^[0-9]+$ ]]; then
      echo "${_ts}"
    else
      node -e 'process.stdout.write(String(Date.now()))'
    fi
  fi
}

cleanup_staging() {
  for resource in components stories assets datasources; do
    rm -rf "${staging_dir}/${resource}/${FAKE_ID}"
  done
  for resource in components stories assets datasources; do
    rmdir "${staging_dir}/${resource}" 2>/dev/null || true
  done
}

cleanup_remote() {
  bash "${skill_dir}/scripts/cleanup-remote.sh" --space "${space_id}" 2>&1 | tail -1
}

# ---------------------------------------------------------------------------
# Validate prerequisites
# ---------------------------------------------------------------------------
if [ ! -f "${cli_bin}" ]; then
  printf "CLI not built. Run: pnpm nx build storyblok\n" >&2
  exit 1
fi

printf "\n"
printf "====================================================================\n"
printf "  Story Push Benchmark\n"
printf "====================================================================\n"
printf "  Space:     %s\n" "${space_id}"
printf "  Stories:   %s\n" "${story_count}"
printf "  Runs:      %s\n" "${runs}"
printf "  Label:     %s\n" "${label}"
printf "====================================================================\n\n"

# ---------------------------------------------------------------------------
# Seed data (done once, reused across runs)
# ---------------------------------------------------------------------------
printf "Seeding %s stories...\n" "${story_count}"
cleanup_staging

# Stage default components
default_components_dir="${skill_dir}/scenarios/has-default-components/components"
if [ -d "${default_components_dir}" ]; then
  mkdir -p "${staging_dir}/components/${FAKE_ID}"
  cp -r "${default_components_dir}/"* "${staging_dir}/components/${FAKE_ID}/"
fi

# Generate stories
bash "${seed_script}" "${staging_dir}" "${FAKE_ID}"

# Login
node "${cli_bin}" login --token "${STORYBLOK_TOKEN}" --region eu > /dev/null 2>&1

# ---------------------------------------------------------------------------
# Run benchmark
# ---------------------------------------------------------------------------
create_times=()
update_times=()
total_times=()

trap 'cleanup_staging' EXIT

for i in $(seq 1 "${runs}"); do
  printf "\n--- run %s/%s ---\n" "${i}" "${runs}"

  # Clean remote space
  printf "  Cleaning space... "
  clean_result=$(cleanup_remote)
  printf "%s\n" "${clean_result}"

  # Push components (required for stories push)
  printf "  Pushing components... "
  node "${cli_bin}" components push --from "${FAKE_ID}" --space "${space_id}" --separate-files --path "${staging_dir}" > /dev/null 2>&1
  printf "done\n"

  # --- CREATE: push stories (fresh, no stories exist remotely) ---
  printf "  Pushing stories (create)... "
  create_start=$(now_ms)
  node "${cli_bin}" stories push --from "${FAKE_ID}" --space "${space_id}" --path "${staging_dir}" > /dev/null 2>&1
  create_end=$(now_ms)
  create_ms=$((create_end - create_start))
  printf "%sms\n" "${create_ms}"

  # --- UPDATE: push stories again (all stories already exist) ---
  # Remove manifest so the CLI re-matches by slug
  rm -f "${staging_dir}/stories/${FAKE_ID}/manifest.jsonl"

  printf "  Pushing stories (update)... "
  update_start=$(now_ms)
  node "${cli_bin}" stories push --from "${FAKE_ID}" --space "${space_id}" --path "${staging_dir}" > /dev/null 2>&1
  update_end=$(now_ms)
  update_ms=$((update_end - update_start))
  printf "%sms\n" "${update_ms}"

  total_ms=$((create_ms + update_ms))
  printf "  Total: %sms (create: %sms, update: %sms)\n" "${total_ms}" "${create_ms}" "${update_ms}"

  create_times+=("${create_ms}")
  update_times+=("${update_ms}")
  total_times+=("${total_ms}")

  # Clean up local manifest for next run
  rm -f "${staging_dir}/stories/${FAKE_ID}/manifest.jsonl"
done

# ---------------------------------------------------------------------------
# Calculate statistics
# ---------------------------------------------------------------------------
printf "\n"
printf "====================================================================\n"
printf "  Results: %s\n" "${label}"
printf "====================================================================\n"

result_file="${results_dir}/$(date +%Y%m%d-%H%M%S)-${label}.json"

compare_arg=""
if [ -n "${compare}" ]; then
  compare_arg="--compare ${compare}"
fi

node "${bench_dir}/scripts/compute-stats.mjs" \
  --label "${label}" \
  --stories "${story_count}" \
  --runs "${runs}" \
  --space "${space_id}" \
  --create-times "$(IFS=,; echo "${create_times[*]}")" \
  --update-times "$(IFS=,; echo "${update_times[*]}")" \
  --output "${result_file}" \
  ${compare_arg}

printf "\n  Results saved to: %s\n" "${result_file}"
