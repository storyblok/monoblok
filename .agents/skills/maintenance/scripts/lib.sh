#!/usr/bin/env bash
# Shared helpers, sourced by the other scripts.

# gh_retry <gh args...>: run gh, retrying twice on failure (the GraphQL endpoint times out now and
# then when comments are included). Prints stdout; exits the script after the last failure.
gh_retry() {
  local out attempt
  for attempt in 1 2 3; do
    if out="$(gh "$@")" && [ -n "$out" ]; then
      printf '%s' "$out"
      return 0
    fi
    [ "$attempt" -lt 3 ] && { echo "gh $1 $2 failed (attempt $attempt), retrying" >&2; sleep 3; }
  done
  echo "gh $* failed after 3 attempts" >&2
  exit 1
}

# warn_if_truncated <count> <limit> <what>: stderr warning when a list hit its limit.
warn_if_truncated() {
  [ "$1" -ge "$2" ] && echo "warning: $3 hit the limit of $2, results may be incomplete" >&2
  return 0
}
