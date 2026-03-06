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
#   Call after parsing args (and after load_env). Falls back to
#   STORYBLOK_SPACE_ID env var.
#
#   --space can be a literal space ID *or* an env-var name (e.g.
#   STORYBLOK_SPACE_ID_TARGET). If the value looks like an env-var name
#   (all caps / underscores, no digits-only), it is resolved against the
#   env loaded by load_env.  This lets callers write:
#
#     --space STORYBLOK_SPACE_ID_TARGET
#
#   instead of having to pre-source the env file themselves.
#
#   Sets the global `space_id` variable or exits with an error.
# ---------------------------------------------------------------------------
require_space_id() {
  # Resolve symbolic env-var names (e.g. STORYBLOK_SPACE_ID_TARGET → its value)
  if [[ "${space_id:-}" =~ ^[A-Z][A-Z0-9_]+$ ]]; then
    space_id="${!space_id:-}"
  fi

  if [ -z "${space_id:-}" ]; then
    space_id="${STORYBLOK_SPACE_ID:-}"
  fi

  if [ -z "${space_id}" ]; then
    printf "Missing --space <spaceId> and no STORYBLOK_SPACE_ID in env.\n" >&2
    exit 1
  fi
}
