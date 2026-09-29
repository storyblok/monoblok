#!/usr/bin/env bash
# Wipes the QA space and seeds the given qa-engineer-manual scenario.
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "${repo_root}"
bash .agents/skills/qa-engineer-manual/scripts/seed-scenario.sh --scenario "${1:-has-stories}"
