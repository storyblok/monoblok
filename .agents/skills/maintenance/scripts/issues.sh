#!/usr/bin/env bash
# Open issues awaiting triage in every digest repo (see lib.sh repos_json), split into stale and
# active. Requires gh and jq.
#
# Keeps issues labeled `status: triage` plus those with no `status:` label. Activity ignores bot
# comments. Stale: last activity (newest human comment, or creation) 90 or more days ago.
# Output: { "stale":  [{repo,ref,number,title,url,days,lastActivity,action}],   most recent first
#           "active": [{repo,ref,number,title,url,createdAt,lastActivity,labels,lastMaintainerComment}] }
#                                                                              newest first
# `ref` is "#N" for monoblok and "<short>#N" for other repos; use it in reports and the digest.
# `action` is "close for inactivity" when the last human commenter is an OWNER/MEMBER/COLLABORATOR,
# else "needs a maintainer reply". `lastActivity` is a full ISO timestamp for active issues (compare
# it with a triage report's modification time to decide whether to reuse the report), a date for
# stale ones.

set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
. "$here/lib.sh"

limit=200
per_repo() {
  local repo="$1" short="$2" issues
  issues="$(gh_retry issue list --repo "$repo" --state open --limit "$limit" \
    --json number,title,url,labels,createdAt,comments)"
  warn_if_truncated "$(jq length <<<"$issues")" "$limit" "$repo issue list"
  jq --arg repo "$repo" --arg short "$short" '
    # gh reports bot comment authors by bare login (e.g. "github-actions"), without a bot flag.
    def human: select((.author.login // "")
      | (endswith("[bot]") or startswith("app/")
         or IN("github-actions", "pkg-pr-new", "dependabot", "renovate", "changeset-bot", "codecov", "vercel"))
      | not);
    def maint: IN("OWNER", "MEMBER", "COLLABORATOR");
    def humans: [.comments[] | human];
    def last_at: ((humans | last | .createdAt) // .createdAt);
    def days: ((now - (last_at | fromdateiso8601)) / 86400 | floor);
    def ref: (if $short == "monoblok" then "#\(.number)" else "\($short)#\(.number)" end);
    [ .[] | select(([.labels[].name | select(startswith("status:"))] | length == 0)
                   or ([.labels[].name] | index("status: triage"))) ] as $kept
    | { stale: [ $kept[] | select(days >= 90)
                 | { repo: $repo, ref: ref, number, title, url, days: days, lastActivity: (last_at | .[0:10]),
                     action: (if ((humans | last | .authorAssociation) // "") | maint
                              then "close for inactivity" else "needs a maintainer reply" end) } ],
        active: [ $kept[] | select(days < 90)
                  | { repo: $repo, ref: ref, number, title, url, createdAt, lastActivity: last_at,
                      labels: [.labels[].name],
                      lastMaintainerComment: ([humans[] | select(.authorAssociation | maint) | .createdAt] | last) } ] }' \
    <<<"$issues"
}

while read -r repo short; do per_repo "$repo" "$short"; done < <(repo_list) |
  jq -s '{ stale: ([.[].stale[]] | sort_by(.days)),
           active: ([.[].active[]] | sort_by(.createdAt) | reverse) }'
