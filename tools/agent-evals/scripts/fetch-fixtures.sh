#!/usr/bin/env bash
# Writes public issue text for every case into fixtures/issues/, so runs need no network.
set -euo pipefail
evals_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "${evals_dir}/fixtures/issues"
for issue in $(node -e 'import("'"${evals_dir}"'/src/cases.ts").then(m=>m.BUG_CASES.forEach(c=>console.log(c.issue)))'); do
  gh issue view "${issue}" --repo storyblok/monoblok --json title,body \
    --jq '"# " + .title + "\n\n" + .body' >"${evals_dir}/fixtures/issues/${issue}.md"
done
