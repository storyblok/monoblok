#!/usr/bin/env bash
# Link open PRs to the issues they close. Requires gh and jq.
#
# A PR is linked to GitHub issue #N when GitHub reports it as a closing reference or the title/body
# says "fixes|closes|resolves #N", and to Linear ticket DX-N when the id appears in the branch name,
# title or body. A PR that only mentions #N in its title or body is "related". Bot PRs are skipped.
#
# Usage: linked-prs.sh [--repo owner/name] [issue-id...]   e.g. linked-prs.sh 866 DX-123
#   --repo defaults to storyblok/monoblok.
# Output: { "byIssue": { "<id>": [PR numbers] }, "related": { "<id>": [PR numbers] },
#           "unlinked": [non-draft PR numbers], "drafts": [PR numbers] }
# byIssue is ordered newest first: a newer PR usually supersedes older ones.

set -euo pipefail

repo="storyblok/monoblok"
if [ "${1:-}" = "--repo" ]; then
  repo="${2:?--repo needs owner/name}"
  shift 2
fi

limit=200
prs=""
for attempt in 1 2 3; do
  prs="$(gh pr list --repo "$repo" --state open --limit "$limit" \
    --json number,title,body,headRefName,author,isDraft,closingIssuesReferences)" && [ -n "$prs" ] && break
  prs=""
  [ "$attempt" -lt 3 ] && { echo "gh pr list failed (attempt $attempt), retrying" >&2; sleep 3; }
done
[ -n "$prs" ] || { echo "gh pr list failed after 3 attempts" >&2; exit 1; }
[ "$(jq length <<<"$prs")" -ge "$limit" ] &&
  echo "warning: PR list hit the limit of $limit, results may be incomplete" >&2

jq --args '
    [$ARGS.positional[] | ascii_upcase | ltrimstr("#")] as $ids
    | [ .[] | select(.author.is_bot | not)
        | ([.title, .body, .headRefName] | map(. // "") | join("\n")) as $text
        | { number, isDraft,
            refs: ([(.closingIssuesReferences[].number | tostring),
                    ($text | match("(?i)\\b(?:fix(?:e[sd])?|close[sd]?|resolve[sd]?):? +#([0-9]+)"; "g").captures[0].string),
                    ($text | match("(?i)\\bdx-[0-9]+"; "g").string | ascii_upcase)] | unique),
            mentions: ([$text | match("#([0-9]+)"; "g").captures[0].string] | unique) } ] as $prs
    | { byIssue: ([$ids[] as $id | {key: $id, value: ([$prs[] | select(.refs | index($id))] | sort_by(-.number) | map(.number))}] | from_entries),
        related: ([$ids[] as $id | {key: $id, value: [$prs[] | select((.refs | index($id) | not) and (.mentions | index($id))) | .number]}] | from_entries),
        unlinked: [$prs[] | select((.refs | length == 0) and (.isDraft | not)) | .number],
        drafts: [$prs[] | select(.isDraft) | .number] }' \
  "$@" <<<"$prs"
