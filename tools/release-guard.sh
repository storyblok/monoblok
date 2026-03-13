#!/usr/bin/env bash

# Release guard — single source of truth for cross-package change detection.
#
# Warns when a feat/fix PR touches multiple packages/ directories.
# In a squash-merge workflow, Nx release uses file changes (not commit scope)
# to determine which packages to bump, so cross-package feat/fix PRs cause
# unintended version bumps.
#
# Modes:
#   (default)  Pre-commit hook. Detects branch, queries gh for PR title,
#              uses git diff for changed files. Prints a human-readable warning.
#   --ci       CI mode. Reads PR title from $PR_TITLE env var and changed file
#              list from stdin. Outputs touched packages to stdout (one per line)
#              and exits 1 when cross-package changes are detected, 0 otherwise.

BUMP_PATTERN='^(feat|fix)(\([^)]+\))?!?:'

CI_MODE=false
if [ "$1" = "--ci" ]; then
  CI_MODE=true
fi

# ── Resolve PR title ────────────────────────────────────────────────

if [ "$CI_MODE" = true ]; then
  if [ -z "$PR_TITLE" ]; then
    echo "Error: PR_TITLE env var not set in CI mode" >&2
    exit 0
  fi
else
  # Skip on main — nothing to compare against
  BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
  if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "HEAD" ]; then
    exit 0
  fi

  if ! command -v gh &>/dev/null; then
    exit 0
  fi

  PR_TITLE=$(gh pr view "$BRANCH" --json title --jq '.title' 2>/dev/null)
  if [ -z "$PR_TITLE" ]; then
    exit 0
  fi
fi

# ── Check bump pattern ──────────────────────────────────────────────

if ! echo "$PR_TITLE" | grep -qE "$BUMP_PATTERN"; then
  exit 0
fi

# ── Collect changed files ───────────────────────────────────────────

if [ "$CI_MODE" = true ]; then
  CHANGED_FILES=$(cat)
else
  MERGE_BASE=$(git merge-base HEAD main 2>/dev/null || git merge-base HEAD origin/main 2>/dev/null)
  if [ -z "$MERGE_BASE" ]; then
    exit 0
  fi

  CHANGED_FILES=$(
    {
      git diff --name-only "$MERGE_BASE"..HEAD 2>/dev/null
      git diff --cached --name-only 2>/dev/null
    } | sort -u
  )
fi

if [ -z "$CHANGED_FILES" ]; then
  exit 0
fi

# ── Extract unique package directories ──────────────────────────────

PACKAGES=$(echo "$CHANGED_FILES" | grep -oE '^packages/[^/]+' | sort -u)
PACKAGE_COUNT=$(echo "$PACKAGES" | grep -c . || true)

if [ "$PACKAGE_COUNT" -le 1 ]; then
  exit 0
fi

# ── Extract commit prefix (everything before the colon) ─────────────

COMMIT_PREFIX=$(echo "$PR_TITLE" | sed 's/:.*//')

# ── Output ──────────────────────────────────────────────────────────

if [ "$CI_MODE" = true ]; then
  echo "COMMIT_PREFIX=$COMMIT_PREFIX"
  echo "$PACKAGES"
  exit 1
fi

echo ""
echo "⚠️  Cross-package changes detected"
echo ""
echo "PR title: $PR_TITLE"
echo ""
echo "Files on this branch (including staged) touch $PACKAGE_COUNT packages:"
echo "$PACKAGES" | sed 's/^/  - /'
echo ""
echo "When this PR is squash-merged, Nx release uses file changes (not the"
echo "commit scope) to determine which packages to bump, so every package"
echo "above will get a version bump."
echo ""
echo "If changes to some packages are cosmetic (README, config, deps),"
echo "split them into a separate PR with a chore: title."
echo ""

exit 0
