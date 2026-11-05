#!/usr/bin/env bash
# Print the digest window start as ISO 8601 UTC: 00:00 of the previous weekday (Friday on Monday,
# Sunday and Saturday resolve to Friday too). With --epoch, print Unix seconds instead (for Slack's
# `after` and for comparing with message ts). Requires jq.
jq -nr --arg fmt "${1:-}" 'now as $n | ($n | strftime("%u") | tonumber) as $dow
  | (if $dow == 1 then 3 elif $dow == 7 then 2 else 1 end) as $back
  | ($n - ($n % 86400) - $back * 86400)
  | if $fmt == "--epoch" then floor else strftime("%Y-%m-%dT%H:%M:%SZ") end'
