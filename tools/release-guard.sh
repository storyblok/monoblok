#!/usr/bin/env bash

# Release guard pre-commit hook
#
# Warns when a feat/fix PR touches multiple packages/ directories.
# In a squash-merge workflow, Nx release uses file changes (not commit scope)
# to determine which packages to bump, so cross-package feat/fix PRs cause
# unintended version bumps.
#
# Only triggers when an open PR exists with a feat/fix title. Requires the
# gh CLI to be installed and authenticated.

BUMP_PATTERN='^(feat|fix)(\(.*\))?[!]?[[:space:]]*:'

# Skip on main — nothing to compare against
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "HEAD" ]; then
  exit 0
fi

# Need gh CLI to check PR title
if ! command -v gh &>/dev/null; then
  exit 0
fi

# Check if there's an open PR and whether its title is feat/fix
PR_TITLE=$(gh pr view "$BRANCH" --json title --jq '.title' 2>/dev/null)
if [ -z "$PR_TITLE" ]; then
  exit 0
fi

if ! echo "$PR_TITLE" | grep -qE "$BUMP_PATTERN"; then
  exit 0
fi

# Find the merge base with main
MERGE_BASE=$(git merge-base HEAD main 2>/dev/null || git merge-base HEAD origin/main 2>/dev/null)

if [ -z "$MERGE_BASE" ]; then
  exit 0
fi

# Collect all changed files: branch commits + currently staged
CHANGED_FILES=$(
  {
    git diff --name-only "$MERGE_BASE"..HEAD 2>/dev/null
    git diff --cached --name-only 2>/dev/null
  } | sort -u
)

if [ -z "$CHANGED_FILES" ]; then
  exit 0
fi

# Extract unique package directories
PACKAGES=$(echo "$CHANGED_FILES" | grep -oE '^packages/[^/]+' | sort -u)
PACKAGE_COUNT=$(echo "$PACKAGES" | grep -c . || true)

if [ "$PACKAGE_COUNT" -le 1 ]; then
  exit 0
fi

# --- Warning ---

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
