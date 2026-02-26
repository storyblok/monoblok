#!/usr/bin/env bash
# Shared helpers for qa-engineer-manual scripts.
# Source this file — do NOT execute it directly.
#
# Provides:
#   load_env             — loads .env.qa-engineer-manual and asserts STORYBLOK_TOKEN
#   require_space_id     — ensures space_id is set (from arg or env), exits if not

# ---------------------------------------------------------------------------
# load_env
# ---------------------------------------------------------------------------
load_env() {
  local env_file="${PWD}/.env.qa-engineer-manual"

  if [ -f "${env_file}" ]; then
    set -a
    # shellcheck source=/dev/null
    source "${env_file}"
    set +a
  fi

  : "${STORYBLOK_TOKEN:?Missing STORYBLOK_TOKEN in ${env_file}}"
}

# ---------------------------------------------------------------------------
# require_space_id
#   Call after parsing args. Falls back to STORYBLOK_SPACE_ID env var.
#   Sets the global `space_id` variable or exits with an error.
# ---------------------------------------------------------------------------
require_space_id() {
  if [ -z "${space_id:-}" ]; then
    space_id="${STORYBLOK_SPACE_ID:-}"
  fi

  if [ -z "${space_id}" ]; then
    printf "Missing --space <spaceId> and no STORYBLOK_SPACE_ID in env.\n" >&2
    exit 1
  fi
}
