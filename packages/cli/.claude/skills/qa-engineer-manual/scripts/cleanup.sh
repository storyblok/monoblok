#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

printf "cleaning remote environment...\n"
"${SCRIPT_DIR}/cleanup-remote.sh"

printf "\ncleaning local environment...\n"
"${SCRIPT_DIR}/cleanup-local.sh"
