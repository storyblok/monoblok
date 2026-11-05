#!/usr/bin/env bash
# Everything open in the watched repos (`watch: true` in repos.json or extraRepos), so low-traffic
# repos stay visible even when nothing in them needs a maintainer. Requires gh and jq.
# Output: [{repo, short, issues: [{ref,title,url,createdAt,author}],
#           prs: [{ref,title,url,createdAt,author,isDraft,review}], botPrs: N}]
# Lists are newest first; bot PRs are only counted.

set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
. "$here/lib.sh"

repos_json | jq -r '.[] | select(.watch) | "\(.repo) \(.short)"' | while read -r repo short; do
  issues="$(gh_retry issue list --repo "$repo" --state open --limit 100 \
    --json number,title,url,createdAt,author)"
  prs="$(gh_retry pr list --repo "$repo" --state open --limit 100 \
    --json number,title,url,createdAt,author,isDraft,reviewDecision)"
  jq -n --arg repo "$repo" --arg short "$short" --argjson i "$issues" --argjson p "$prs" '
    def item: {ref: "\($short)#\(.number)", title, url, createdAt, author: .author.login};
    { repo: $repo, short: $short,
      issues: ($i | sort_by(.createdAt) | reverse | map(item)),
      prs: ($p | map(select(.author.is_bot | not)) | sort_by(.createdAt) | reverse
            | map(item + {isDraft, review: (if (.reviewDecision // "") == "" then "none" else .reviewDecision end)})),
      botPrs: ($p | map(select(.author.is_bot)) | length) }'
done | jq -s '.'
