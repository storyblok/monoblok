#!/usr/bin/env bash
# Open PRs split into outside-contributor and member lists. Requires gh and jq.
#
# Bots are dropped. A PR author counts as a member when GitHub reports OWNER, MEMBER or COLLABORATOR;
# a maintainer with private org membership shows as CONTRIBUTOR and lands in `outside`.
# Output: { "window": "<iso>",
#   "outside": [{number,title,url,author,size,changedFiles,ci,review,isDraft,notes:[...],
#                lastMaintainerActivity}],
#   "members": [{number,title,url,review}] }
# `ci`: "fail" (FAILURE, ERROR, TIMED_OUT, CANCELLED, STARTUP_FAILURE, STALE or a failed status),
#   "action required" (a fork PR whose workflows wait for a maintainer to approve), "not run" (a
#   workflow that ended without running any job, e.g. its approval expired), "pending", "pass", or
#   "none" (no checks). "action required" and "not run" come from the check suites of outside PRs.
#   `review` is the reviewDecision, "none" if empty.
# `outside` notes: "new" (created in the window), "stale (N days)" (open 7+ days, review "none" or
#   REVIEW_REQUIRED, no maintainer comment or review in the last 7 days), "approved, not merged"
#   (APPROVED, with the newest approval 7+ days old), "changes requested" (CHANGES_REQUESTED and open 7+ days). Drafts
#   are marked "draft" but only listed when another note applies. Only PRs with at least one note are listed.
# `members`: non-draft PRs without a closing reference or DX id in title, body or branch
#   (linked-prs.sh `unlinked`) that are not APPROVED. Matching them to issues is left to the caller.

set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
. "$here/lib.sh"

window="$("$here/window.sh")"
unlinked="$(bash "$here/../../triage/scripts/linked-prs.sh")"
jq -e '.unlinked' >/dev/null <<<"$unlinked" || { echo "linked-prs.sh returned no data" >&2; exit 1; }
unlinked="$(jq -c '.unlinked' <<<"$unlinked")"

# Without --jq, an empty PR list still prints "[]", which gh_retry accepts.
assoc="$(gh_retry api --paginate 'repos/storyblok/monoblok/pulls?state=open&per_page=100' |
  jq -s 'add // [] | map({key: (.number | tostring), value: .author_association}) | from_entries')"

limit=100
prs="$(gh_retry pr list --repo storyblok/monoblok --state open --limit "$limit" \
  --json number,title,url,author,createdAt,isDraft,reviewDecision,statusCheckRollup,additions,deletions,changedFiles,comments,reviews,headRefOid)"
warn_if_truncated "$(jq length <<<"$prs")" "$limit" "PR list"

result="$(jq --arg window "$window" --argjson unlinked "$unlinked" --argjson assoc "$assoc" '
  def maint: IN("OWNER", "MEMBER", "COLLABORATOR");
  def review: (if (.reviewDecision // "") == "" then "none" else .reviewDecision end);
  def ci: [.statusCheckRollup[]?] as $c
    | if ($c | length) == 0 then "none"
      elif any($c[]; ((.conclusion // "") | IN("FAILURE", "ERROR", "TIMED_OUT", "CANCELLED", "STARTUP_FAILURE", "STALE"))
                      or ((.state // "") | IN("FAILURE", "ERROR"))) then "fail"
      elif any($c[]; (.conclusion // "") == "ACTION_REQUIRED") then "action required"
      elif any($c[]; ((.status // "COMPLETED") != "COMPLETED") or ((.state // "") | IN("PENDING", "EXPECTED"))) then "pending"
      else "pass" end;
  [ .[] | select(.author.is_bot | not) ] as $prs
  | { window: $window,
      outside: [ $prs[] | select(($assoc[.number | tostring] // "NONE") | maint | not)
                 | ((now - (.createdAt | fromdateiso8601)) / 86400 | floor) as $age
                 | ([ (.comments[] | select(.authorAssociation | maint) | .createdAt),
                      (.reviews[] | select(.authorAssociation | maint) | .submittedAt) ] | max) as $lastMaint
                 | (($lastMaint != null) and ((now - ($lastMaint | fromdateiso8601)) < 7 * 86400)) as $answered
                 | .createdAt as $created | ([.reviews[] | select(.state == "APPROVED") | .submittedAt] | max // $created) as $approvedAt
                 | ((now - ($approvedAt | fromdateiso8601)) / 86400 | floor) as $approvedAge
                 | review as $r
                 | ([ (if .createdAt >= $window then "new" else empty end),
                      (if $age >= 7 and ($r | IN("none", "REVIEW_REQUIRED")) and ($answered | not) then "stale (\($age) days)" else empty end),
                      (if $approvedAge >= 7 and $r == "APPROVED" then "approved, not merged" else empty end),
                      (if $age >= 7 and $r == "CHANGES_REQUESTED" then "changes requested" else empty end),
                      (if .isDraft then "draft" else empty end) ]) as $notes
                 | select($notes | any(. != "draft"))
                 | { number, title, url, author: .author.login, size: "+\(.additions)/-\(.deletions)", changedFiles,
                     ci: ci, review: $r, isDraft, notes: $notes, lastMaintainerActivity: $lastMaint,
                     headRefOid } ]
               | sort_by(.number) | reverse,
      members: [ $prs[] | select((($assoc[.number | tostring] // "NONE") | maint)
                                 and (.number | IN($unlinked[])) and (review != "APPROVED"))
                 | { number, title, url, review: review } ] }' <<<"$prs")"

# A fork PR whose workflows wait for approval has a GitHub Actions check suite without check runs,
# which statusCheckRollup does not show. Look those suites up for outside PRs only.
for sha in $(jq -r '.outside[].headRefOid' <<<"$result"); do
  suites="$(gh_retry api "repos/storyblok/monoblok/commits/$sha/check-suites" \
    --jq '[.check_suites[] | select(.app.slug == "github-actions" and .latest_check_runs_count == 0)
           | if .status != "completed" or .conclusion == "action_required" then "action required"
             else "not run" end]')"
  result="$(jq --arg sha "$sha" --argjson s "$suites" '
    .outside |= map(if .headRefOid == $sha and ($s | length) > 0
                    then .ci = (if ($s | index("action required")) then "action required" else "not run" end)
                    else . end)' <<<"$result")"
done
jq '.outside |= map(del(.headRefOid))' <<<"$result"
