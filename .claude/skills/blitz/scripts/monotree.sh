#!/usr/bin/env bash
set -euo pipefail

# monotree - Git worktree helper for monoblok
#
# Usage:
#   monotree.sh add <branch-name>     Create worktree, copy config, install deps, build
#   monotree.sh remove <branch-name>  Remove worktree and delete branch
#   monotree.sh list                  List all worktrees
#
# Expects to be run from the monoblok root directory (or any subdirectory).

# Resolve monoblok root (git toplevel)
MONOBLOK_ROOT="$(git rev-parse --show-toplevel)"

add_worktree() {
  local name="$1"
  local worktree_path="../$name"

  cd "$MONOBLOK_ROOT" || exit 1

  # Create worktree (reuse existing branch or create new)
  if git show-ref --verify --quiet "refs/heads/$name" 2>/dev/null; then
    git worktree add "$worktree_path" "$name"
  else
    git worktree add "$worktree_path" -b "$name"
  fi

  cd "$worktree_path" || exit 1

  # Copy config directories and files
  cp -r "$MONOBLOK_ROOT/.claude" .
  [ -d "$MONOBLOK_ROOT/.zed" ] && cp -r "$MONOBLOK_ROOT/.zed" .
  [ -d "$MONOBLOK_ROOT/claude-output" ] && cp -r "$MONOBLOK_ROOT/claude-output" .
  cp "$MONOBLOK_ROOT/.gitignore" .
  cp "$MONOBLOK_ROOT/CLAUDE.md" .

  # Copy all .env files (preserving directory structure, excluding node_modules)
  (cd "$MONOBLOK_ROOT" && find . -name '.env*' -not -path '*/node_modules/*' -print0 | while IFS= read -r -d '' f; do
    mkdir -p "$(dirname "$worktree_path/$f")"
    cp "$f" "$worktree_path/$f"
  done)

  # Symlink project-level Claude config so worktrees share rules, settings, and memory
  local main_project_key
  main_project_key=$(echo "$MONOBLOK_ROOT" | tr '/' '-' | tr -d '@')
  local worktree_abs
  worktree_abs=$(pwd)
  local worktree_project_key
  worktree_project_key=$(echo "$worktree_abs" | tr '/' '-' | tr -d '@')
  local projects_dir="$HOME/.claude/projects"

  if [ -d "$projects_dir/$main_project_key" ]; then
    mkdir -p "$projects_dir/$worktree_project_key"
    for cfg in CLAUDE.md settings.json memory; do
      local src="$projects_dir/$main_project_key/$cfg"
      local dst="$projects_dir/$worktree_project_key/$cfg"
      if [ -e "$src" ] && [ ! -L "$dst" ]; then
        [ -e "$dst" ] && rm -rf "$dst"
        ln -s "$src" "$dst"
      fi
    done
  fi

  # Install and build
  pnpm install
  pnpm nx run-many -p="tag:npm:public" -t build

  # Open worktree in editor (prefer Zed, fall back to VS Code)
  if command -v zed &>/dev/null; then
    zed .
  elif command -v code &>/dev/null; then
    code .
  fi

  cd "$MONOBLOK_ROOT"
  echo "Worktree ready at $(cd "$worktree_path" && pwd)"
}

remove_worktree() {
  local name="$1"

  cd "$MONOBLOK_ROOT" || exit 1

  # Clean up project-level Claude config symlinks
  local worktree_abs
  worktree_abs=$(cd "../$name" 2>/dev/null && pwd) || true
  if [ -n "$worktree_abs" ]; then
    local worktree_project_key
    worktree_project_key=$(echo "$worktree_abs" | tr '/' '-' | tr -d '@')
    local wt_project_dir="$HOME/.claude/projects/$worktree_project_key"
    if [ -d "$wt_project_dir" ]; then
      for cfg in CLAUDE.md settings.json memory; do
        [ -L "$wt_project_dir/$cfg" ] && rm "$wt_project_dir/$cfg"
      done
    fi
  fi

  # Copy claude-output artifacts back to the main repo
  local worktree_path="../$name"
  if [ -d "$worktree_path/claude-output" ]; then
    mkdir -p "$MONOBLOK_ROOT/claude-output"
    cp -r "$worktree_path/claude-output/." "$MONOBLOK_ROOT/claude-output/"
    echo "Copied claude-output artifacts back to main repo"
  fi

  git worktree remove --force "../$name"
  git branch -D "$name" 2>/dev/null || echo "Branch '$name' already deleted, skipping"
}

list_worktrees() {
  cd "$MONOBLOK_ROOT" || exit 1
  git worktree list
}

# Main dispatch
case "${1:-}" in
  add)
    [ -z "${2:-}" ] && echo "Usage: monotree.sh add <branch-name>" && exit 1
    add_worktree "$2"
    ;;
  remove)
    [ -z "${2:-}" ] && echo "Usage: monotree.sh remove <branch-name>" && exit 1
    remove_worktree "$2"
    ;;
  list)
    list_worktrees
    ;;
  *)
    echo "Usage:"
    echo "  monotree.sh add <name>     Create worktree and set up"
    echo "  monotree.sh remove <name>  Remove worktree"
    echo "  monotree.sh list           List all worktrees"
    exit 1
    ;;
esac
