#!/usr/bin/env bash
# Logs the CLI in inside the job's isolated HOME. The token is read from the
# repo's env file here rather than passed through AXIS `env`, so the agent's
# environment never contains it.
set -euo pipefail
repo_root="$(cd "${AXIS_CONFIG_DIR:-$(dirname "${BASH_SOURCE[0]}")/..}/../.." && pwd)"
set -a
# shellcheck source=/dev/null
source "${repo_root}/.env.qa-engineer-manual"
set +a
storyblok login --token "${STORYBLOK_TOKEN}" --region eu >/dev/null
echo "CLI logged in to space ${STORYBLOK_SPACE_ID} (HOME=${HOME})" >>"${AXIS_OUTPUT:-/dev/null}"
