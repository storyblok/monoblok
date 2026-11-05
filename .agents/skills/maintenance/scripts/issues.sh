#!/usr/bin/env bash
# Open issues awaiting triage, split into stale and active. Requires gh and jq.
#
# Keeps issues labeled `status: triage` plus those with no `status:` label. Activity ignores bot
# comments. Stale: last activity (newest human comment, or creation) 90 or more days ago.
# Output: { "stale":  [{number,title,url,days,lastActivity,action}],   newest first
#           "active": [{number,title,url,createdAt,lastActivity,labels,lastMaintainerComment}] }
# `action` is "close for inactivity" when the last human commenter is an OWNER/MEMBER/COLLABORATOR,
# else "needs a maintainer reply". `lastActivity` is a full ISO timestamp for active issues (compare
# it with a triage report's modification time to decide whether to reuse the report), a date for
# stale ones.

set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
. "$here/lib.sh"

limit=200
issues="$(gh_retry issue list --repo storyblok/monoblok --state open --limit "$limit" \
  --json number,title,url,labels,createdAt,comments)"
warn_if_truncated "$(jq length <<<"$issues")" "$limit" "issue list"

jq '
  # gh reports bot comment authors by bare login (e.g. "github-actions"), without a bot flag.
  def human: select((.author.login // "")
    | (endswith("[bot]") or startswith("app/")
       or IN("github-actions", "pkg-pr-new", "dependabot", "renovate", "changeset-bot", "codecov", "vercel"))
    | not);
  def maint: IN("OWNER", "MEMBER", "COLLABORATOR");
  def humans: [.comments[] | human];
  def last_at: ((humans | last | .createdAt) // .createdAt);
  def days: ((now - (last_at | fromdateiso8601)) / 86400 | floor);
  [ .[] | select(([.labels[].name | select(startswith("status:"))] | length == 0)
                 or ([.labels[].name] | index("status: triage"))) ] as $kept
  | { stale: [ $kept[] | select(days >= 90)
               | { number, title, url, days: days, lastActivity: (last_at | .[0:10]),
                   action: (if ((humans | last | .authorAssociation) // "") | maint
                            then "close for inactivity" else "needs a maintainer reply" end) } ]
               | sort_by(.days),
      active: [ $kept[] | select(days < 90)
                | { number, title, url, createdAt, lastActivity: last_at, labels: [.labels[].name],
                    lastMaintainerComment: ([humans[] | select(.authorAssociation | maint) | .createdAt] | last) } ]
                | sort_by(.number) | reverse }' <<<"$issues"
