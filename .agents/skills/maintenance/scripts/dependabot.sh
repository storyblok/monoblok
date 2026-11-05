#!/usr/bin/env bash
# Open Dependabot alerts in every digest repo, grouped by package. Requires gh and jq.
#
# Output: [{repo, short, error?, counts: {critical, high, medium, low}, groups: [{package,
#           ecosystem, severity, alerts, direct, runtime, packages, manifests, firstSeen, lastSeen,
#           fixedIn, urls}]}]
# `counts` counts groups (packages) per severity.
# One group per package: `severity` is the highest of its alerts (critical > high > medium > low),
# `alerts` their count, `direct`/`runtime` whether any alert is a direct or runtime dependency,
# `packages` the folders under packages/ whose package.json declares it as a runtime dependency
# (so it ships to consumers of a published package), `firstSeen`/`lastSeen` the oldest and newest alert's creation time,
# `fixedIn` the patched versions. Groups are sorted by severity, then newest first.
# `error` is set instead of failing when alerts are disabled or not readable for a repo.
# Alerts are security-sensitive: keep them out of commits, PRs, issues and public channels.

set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
. "$here/lib.sh"

while read -r repo short; do
  if alerts="$(gh api --paginate "repos/$repo/dependabot/alerts?state=open&per_page=100" 2>&1)"; then
    jq -s --arg repo "$repo" --arg short "$short" '
      def rank: {critical: 0, high: 1, medium: 2, low: 3}[.] // 4;
      { repo: $repo, short: $short,
        groups: (add // [] | group_by(.dependency.package.name) | map(
          { package: .[0].dependency.package.name, ecosystem: .[0].dependency.package.ecosystem,
            severity: (map(.security_advisory.severity) | min_by(rank)),
            alerts: length,
            direct: any(.dependency.relationship == "direct"),
            runtime: any(.dependency.scope == "runtime"),
            packages: (map(select(.dependency.scope == "runtime") | .dependency.manifest_path
                           | select(startswith("packages/")) | split("/")[1]) | unique),
            manifests: (map(.dependency.manifest_path) | unique),
            firstSeen: (map(.created_at) | min), lastSeen: (map(.created_at) | max),
            fixedIn: (map(.security_vulnerability.first_patched_version.identifier // empty) | unique),
            urls: map(.html_url) })
          | sort_by([(.severity | rank), (.lastSeen | fromdateiso8601 | -.)])) }
      | .counts = (reduce .groups[] as $g ({critical: 0, high: 0, medium: 0, low: 0};
                     .[$g.severity] += 1))' <<<"$alerts"
  else
    jq -n --arg repo "$repo" --arg short "$short" --arg e "$(head -c 200 <<<"$alerts")" \
      '{repo: $repo, short: $short, error: $e, counts: null, groups: []}'
  fi
done < <(repo_list) | jq -s '.'
