#!/usr/bin/env bash
# Usage: tools/axis/run.sh [axis run flags], e.g. `-s 'space/*'`.
set -euo pipefail
axis_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${axis_dir}/../.." && pwd)"
env_file="${repo_root}/.env.qa-engineer-manual"

# Install the local CLI build from a packed tarball outside the repo, so agents
# see what an npm user gets instead of following a symlink into the monorepo
# sources. Workspace dependencies resolve to their published versions.
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

cd "${axis_dir}"
exec npx -y @netlify/axis@1.17.6 run "$@"
