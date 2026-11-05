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

# repos_json: the repos the digest covers, as a JSON array of {repo, short, watch?}: the committed
# repos.json plus `extraRepos` from the git-ignored config.local.json (for private repos, whose
# names must not be committed).
repos_json() {
  local dir local_cfg
  dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  local_cfg="$dir/config.local.json"
  if [ -f "$local_cfg" ]; then
    jq -s '.[0] + (.[1].extraRepos // [])' "$dir/repos.json" "$local_cfg"
  else
    jq '.' "$dir/repos.json"
  fi
}

# repo_list: one "<owner/repo> <short>" line per repo.
repo_list() {
  repos_json | jq -r '.[] | "\(.repo) \(.short)"'
}
