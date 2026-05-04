#!/usr/bin/env bash
# Fetch Linear issues for triage.
#
# Usage:
#   linear-fetch.sh issue WDX-123          # Single issue by identifier
#   linear-fetch.sh issue WDX-123 WDX-456  # Multiple issues
#   linear-fetch.sh triage                  # Triage issues for WDX team (default)
#   linear-fetch.sh triage --team OTHER    # Triage issues for a different team
#
# Requires LINEAR_API_KEY in the project .env file.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"
LINEAR_API="https://api.linear.app/graphql"
DEFAULT_TEAM="WDX"

# ---------------------------------------------------------------------------
# load_env — loads LINEAR_API_KEY from .env
# ---------------------------------------------------------------------------
load_env() {
  local env_file="${PROJECT_ROOT}/.env"
  if [ -f "${env_file}" ]; then
    set -a
    # shellcheck source=/dev/null
    source "${env_file}"
    set +a
  fi
  : "${LINEAR_API_KEY:?Missing LINEAR_API_KEY in ${env_file}}"
}

# ---------------------------------------------------------------------------
# gql — execute a GraphQL query against the Linear API
# ---------------------------------------------------------------------------
gql() {
  local query="$1"
  local variables="${2:-"{}"}"

  local payload
  payload=$(node -e "process.stdout.write(JSON.stringify({query: process.argv[1], variables: JSON.parse(process.argv[2])}))" "$query" "$variables")

  curl -s -X POST "${LINEAR_API}" \
    -H "Content-Type: application/json" \
    -H "Authorization: ${LINEAR_API_KEY}" \
    -d "$payload"
}

# ---------------------------------------------------------------------------
# fetch_issue — fetch a single issue by identifier (e.g. WDX-123)
# ---------------------------------------------------------------------------
fetch_issue() {
  local identifier="$1"

  local query='
    query($filter: IssueFilter) {
      issues(filter: $filter, first: 1) {
        nodes {
          identifier
          title
          description
          priority
          priorityLabel
          state { name type }
          assignee { name }
          creator { name }
          labels { nodes { name } }
          comments { nodes { body user { name } createdAt } }
          createdAt
          updatedAt
          url
          parent { identifier title }
          children { nodes { identifier title state { name } } }
          relations { nodes { type relatedIssue { identifier title state { name } } } }
        }
      }
    }
  '

  # Extract team key and number from identifier (e.g. WDX-123)
  local team_key="${identifier%%-*}"
  local number="${identifier##*-}"

  local variables
  variables=$(jq -n \
    --arg team "$team_key" \
    --argjson num "$number" \
    '{ filter: { team: { key: { eq: $team } }, number: { eq: $num } } }')

  gql "$query" "$variables"
}

# ---------------------------------------------------------------------------
# fetch_triage — fetch issues in Triage state
# ---------------------------------------------------------------------------
fetch_triage() {
  local team_key="${DEFAULT_TEAM}"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --team) team_key="$2"; shift 2 ;;
      *) shift ;;
    esac
  done

  local query='
    query($filter: IssueFilter) {
      issues(filter: $filter, first: 50, orderBy: createdAt) {
        nodes {
          identifier
          title
          description
          priority
          priorityLabel
          state { name type }
          assignee { name }
          creator { name }
          labels { nodes { name } }
          createdAt
          updatedAt
          url
          parent { identifier title }
          relations { nodes { type relatedIssue { identifier title state { name } } } }
        }
      }
    }
  '

  local variables
  if [ -n "$team_key" ]; then
    variables=$(jq -n \
      --arg team "$team_key" \
      '{ filter: { state: { type: { eq: "triage" } }, team: { key: { eq: $team } } } }')
  else
    variables=$(jq -n \
      '{ filter: { state: { type: { eq: "triage" } } } }')
  fi

  gql "$query" "$variables"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
load_env

command="${1:-}"
shift || true

case "$command" in
  issue)
    if [ $# -eq 0 ]; then
      echo "Usage: linear-fetch.sh issue WDX-123 [WDX-456 ...]" >&2
      exit 1
    fi
    # Fetch each issue and collect results
    for id in "$@"; do
      echo "--- ${id} ---"
      fetch_issue "$id" | jq '.data.issues.nodes[0] // empty'
    done
    ;;
  triage)
    fetch_triage "$@" | jq '.data.issues.nodes // empty'
    ;;
  *)
    echo "Usage: linear-fetch.sh <issue|triage> [args...]" >&2
    echo ""
    echo "Commands:"
    echo "  issue WDX-123 [WDX-456 ...]   Fetch specific issues by identifier"
    echo "  triage [--team WDX]            Fetch all issues in Triage state"
    exit 1
    ;;
esac
