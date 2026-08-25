#!/usr/bin/env bash
set -euo pipefail

# Reads and optionally sets a Storyblok space's preview domain.
#
# The preview domain is what the Visual Editor loads in its iframe. For local
# QA it must be an https URL: the editor is served over https and Chromium
# blocks an http iframe as mixed content, leaving a blank preview and no error.
#
# Read-only by default. Without --confirm nothing is written.
#
# Usage:
#   bash .agents/skills/qa-engineer-manual/scripts/configure-space.sh
#   bash .agents/skills/qa-engineer-manual/scripts/configure-space.sh --domain https://localhost:3200/
#   bash .agents/skills/qa-engineer-manual/scripts/configure-space.sh --domain https://localhost:3200/ --confirm

# shellcheck source=_common.sh
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"
load_env

space_id=""
domain=""
confirm=false

while [ "$#" -gt 0 ]; do
  case "$1" in
    --space)   space_id="$2"; shift 2 ;;
    --domain)  domain="$2"; shift 2 ;;
    --confirm) confirm=true; shift 1 ;;
    *)         printf "warning: unknown argument '%s'\n" "$1" >&2; shift 1 ;;
  esac
done

require_space_id

mapi_base_url="${STORYBLOK_MAPI_URL:-https://mapi.storyblok.com/v1}"
api="${mapi_base_url}/spaces/${space_id}"

current="$(curl -sS -H "Authorization: ${STORYBLOK_TOKEN}" "${api}" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const s=JSON.parse(d).space;console.log(s.domain ?? '')})")"

printf "space:   %s\n" "${space_id}"
printf "current: %s\n" "${current:-<unset>}"

if [ -z "${domain}" ]; then
  printf "No --domain given; nothing to change.\n"
  exit 0
fi

printf "intended: %s\n" "${domain}"

case "${domain}" in
  https://*) ;;
  *) printf "Refusing: --domain must be https, or the editor iframe is blocked as mixed content.\n" >&2
     exit 1 ;;
esac

if [ "${current}" = "${domain}" ]; then
  printf "Already set; nothing to do.\n"
  exit 0
fi

if [ "${confirm}" = false ]; then
  printf "Dry run. Re-run with --confirm to write this change.\n"
  exit 0
fi

curl -sS -X PUT "${api}" \
  -H "Authorization: ${STORYBLOK_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"space\":{\"domain\":\"${domain}\"}}" \
  -o /dev/null -w "http %{http_code}\n"

printf "Set domain to %s\n" "${domain}"
