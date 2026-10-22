#!/usr/bin/env bash
# unpack-tarball.sh <tarball> <expected-sha256> <dest>
#
# Unpacks a blueprint tarball that went through a job running untrusted code (adr/0022). The
# tarball must be the one `stage` hashed: `stage` builds its tree from this repository, so a
# matching hash is what makes the contents trustworthy. <dest> must not exist yet. A `.git` in the
# result is refused, because `push` copies the tree over a checkout whose `.git` it must not touch.
set -euo pipefail

tarball=$1
expected=$2
dest=$3

fail() {
  echo "::error::$1" >&2
  exit 1
}

if command -v sha256sum >/dev/null; then
  actual=$(sha256sum "$tarball" | cut -d' ' -f1)
else
  actual=$(shasum -a 256 "$tarball" | cut -d' ' -f1)
fi
# An empty expected hash never matches.
[ -n "$expected" ] && [ "$actual" = "$expected" ] || fail "Tarball does not match the hash stage published"

[ ! -e "$dest" ] || fail "$dest already exists"
mkdir -p "$dest"
tar -xzf "$tarball" -C "$dest" --no-same-owner --no-same-permissions
if [ -n "$(find "$dest" -name .git -print -quit)" ]; then
  rm -rf "$dest"
  fail "Unpacked tree has a .git"
fi
