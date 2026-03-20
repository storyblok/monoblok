#!/usr/bin/env bash

# Release guard — CI check for cross-package change detection.
#
# Warns when a feat/fix PR touches multiple packages/ directories.
# In a squash-merge workflow, Nx release uses file changes (not commit scope)
# to determine which packages to bump, so cross-package feat/fix PRs cause
# unintended version bumps.
#
# Usage (CI):
#   PR_TITLE="feat: ..." bash tools/release-guard.sh < changed-files.txt
#
# Reads PR title from $PR_TITLE env var and changed file list from stdin.
# Outputs touched packages to stdout (one per line) and exits 1 when
# cross-package changes are detected, 0 otherwise.

BUMP_PATTERN='^(feat|fix)(\([^)]+\))?!?:'

if [ -z "$PR_TITLE" ]; then
  echo "Error: PR_TITLE env var not set" >&2
  exit 0
fi

# ── Check bump pattern ──────────────────────────────────────────────

if ! echo "$PR_TITLE" | grep -qE "$BUMP_PATTERN"; then
  exit 0
fi

# ── Collect changed files ───────────────────────────────────────────

CHANGED_FILES=$(cat)

if [ -z "$CHANGED_FILES" ]; then
  exit 0
fi

# ── Extract unique package directories ──────────────────────────────

PACKAGES=$(echo "$CHANGED_FILES" | grep -oE '^packages/[^/]+' | sort -u)
PACKAGE_COUNT=$(echo "$PACKAGES" | grep -c . || true)

if [ "$PACKAGE_COUNT" -le 1 ]; then
  exit 0
fi

# ── Output ──────────────────────────────────────────────────────────

COMMIT_PREFIX=$(echo "$PR_TITLE" | sed 's/:.*//')

echo "COMMIT_PREFIX=$COMMIT_PREFIX"
echo "$PACKAGES"
exit 1
