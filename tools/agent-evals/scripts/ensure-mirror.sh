#!/usr/bin/env bash
# Keeps a bare mirror of monoblok that workspaces are exported from.
set -euo pipefail
mirror="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.cache/monoblok.git"
if [ -d "${mirror}" ]; then
  git -C "${mirror}" fetch --quiet --prune origin
else
  git clone --quiet --mirror https://github.com/storyblok/monoblok "${mirror}"
fi
