#!/usr/bin/env bash
# Per-thread verdict cache so unchanged Slack threads are not read again. Requires jq.
#
# Usage:
#   slack-cache.sh get <thread_ts> <fingerprint>   prints the cached entry as JSON, or nothing when
#                                                   there is none or the fingerprint changed
#   slack-cache.sh put <thread_ts> <fingerprint> <verdict> <note>
#   slack-cache.sh list                             prints the whole cache
# `fingerprint` identifies the thread state, built from the channel read as described in
# sources/slack.md, e.g. "replies=13;last=2026-10-30 11:10:18 CET;reactions=eyes (1)".
# `verdict` is one of answered, not-dx, open, promise (see sources/slack.md). Verdicts describe the
# thread only, never its age, so a hit stays valid as time passes. An entry written under other
# verdict rules (a `rules` value other than $rules) counts as a miss; bump it when the rules in
# sources/slack.md change.
# `put` drops entries whose thread is older than 90 days, since the channel read never reaches them.
# The cache lives in <repo>/claude-output/ (git-ignored) as maintenance-slack-cache.json.

set -euo pipefail
verdicts='["answered","not-dx","open","promise"]'
rules=3
usage() {
  echo "usage: slack-cache.sh get <ts> <fingerprint> | put <ts> <fingerprint> <answered|not-dx|open|promise> <note> | list" >&2
  exit 2
}

root="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
file="$root/claude-output/maintenance-slack-cache.json"
mkdir -p "$(dirname "$file")"
[ -s "$file" ] || echo '{}' >"$file"
valid_ts() { [[ "$1" =~ ^[0-9]+\.[0-9]+$ ]] || usage; }

case "${1:-}" in
  get)
    [ $# -eq 3 ] || usage
    valid_ts "$2"
    jq -c --arg ts "$2" --arg fp "$3" --argjson r "$rules" \
      '.[$ts] | select(. != null and .fingerprint == $fp and .rules == $r)' "$file"
    ;;
  put)
    [ $# -eq 5 ] || usage
    valid_ts "$2"
    jq -en --arg v "$4" --argjson vs "$verdicts" '$v | IN($vs[])' >/dev/null || usage
    # Serialize writers: parallel runs would otherwise lose each other's entries.
    lock="$file.lock"
    got=""
    for _ in $(seq 1 50); do mkdir "$lock" 2>/dev/null && { got=1; break; }; sleep 0.1; done
    [ -n "$got" ] || { echo "could not lock $file; remove $lock if no run is active" >&2; exit 1; }
    # Same directory as the cache, so the mv is an atomic rename.
    tmp="$(mktemp "$file.XXXXXX")"
    trap 'rm -f "$tmp"; rmdir "$lock"' EXIT
    jq --arg ts "$2" --arg fp "$3" --arg v "$4" --arg n "$5" --argjson r "$rules" '
      with_entries(select((.key | tonumber? // 0) > now - 90 * 86400))
      | .[$ts] = {fingerprint: $fp, verdict: $v, note: $n, rules: $r, checkedAt: (now | todate)}' "$file" >"$tmp"
    [ -s "$tmp" ] || { echo "refusing to write an empty cache" >&2; exit 1; }
    chmod 644 "$tmp"
    mv "$tmp" "$file"
    ;;
  list)
    [ $# -eq 1 ] || usage
    cat "$file"
    ;;
  *)
    usage
    ;;
esac
