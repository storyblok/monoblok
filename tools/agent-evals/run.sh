#!/usr/bin/env bash
# Usage: tools/agent-evals/run.sh -p <cli|skills|spec> [axis run flags]
set -euo pipefail
evals_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${evals_dir}/../.." && pwd)"
env_file="${repo_root}/.env.qa-engineer-manual"

profile=""
args=("$@")
for ((i = 0; i < ${#args[@]}; i++)); do
  case "${args[$i]}" in
    -p | --profile) profile="${args[$((i + 1))]:-}" ;;
    --profile=*) profile="${args[$i]#--profile=}" ;;
  esac
done

if [ "${profile}" = "cli" ]; then
  # Install the local CLI build from a packed tarball outside the repo, so agents
  # see what an npm user gets. Workspace dependencies resolve to published versions.
  cli_prefix="${TMPDIR:-/tmp}/axis-storyblok-cli"
  pack_dir="$(mktemp -d)"
  (cd "${repo_root}" && pnpm nx build storyblok >/dev/null)
  (cd "${repo_root}/packages/cli" && pnpm pack --pack-destination "${pack_dir}" >/dev/null)
  rm -rf "${cli_prefix}"
  npm install --global --silent --prefix "${cli_prefix}" "${pack_dir}"/storyblok-*.tgz
  rm -rf "${pack_dir}"
  export PATH="${cli_prefix}/bin:${PATH}"

  if [ -f "${env_file}" ]; then
    # Only the space ID is exported; the token stays in the env file (see scripts/login.sh).
    STORYBLOK_SPACE_ID="$(set -a; source "${env_file}"; echo "${STORYBLOK_SPACE_ID:-}")"
    export STORYBLOK_SPACE_ID
  fi
fi

cd "${evals_dir}"
node "${evals_dir}/scripts/prepare-arms.ts"
bash "${evals_dir}/scripts/ensure-mirror.sh"
AGENT_EVALS_PNPM_STORE="$(pnpm store path)"
export AGENT_EVALS_PNPM_STORE
exec pnpm exec axis run "$@"
