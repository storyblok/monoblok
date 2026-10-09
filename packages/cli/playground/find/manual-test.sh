#!/usr/bin/env bash
# Behaviour checks for `storyblok stories find` against a real space.
#
# Where `scenarios.sh` measures how fast a fixed set of queries runs, this checks
# that the command answers correctly: exit codes, the JSONL contract, what each
# filter keeps, and that the optimization flags never change the result set.
# Every check passes or fails on its own, and the run exits 1 if any failed.
#
# Nothing is hard-coded to a space. A metadata-only listing is read first, and
# the values the checks need (a content type, a tag, a nested block, a
# reference) are picked from it, so the script runs against any space. Checks
# whose prerequisite the space does not have are skipped, not failed.
#
# Checks that fetch content run inside one small subtree, so a full sweep takes
# a couple of minutes at the default rate limit. `--scope` picks that subtree.
#
# Usage, from anywhere in the repository:
#   bash packages/cli/playground/find/manual-test.sh                     # every section
#   bash packages/cli/playground/find/manual-test.sh usage sort          # sections by name
#   bash packages/cli/playground/find/manual-test.sh --list              # list sections
#   bash packages/cli/playground/find/manual-test.sh --space 12345       # another space
#   bash packages/cli/playground/find/manual-test.sh --scope en/blog     # content-check subtree
#   bash packages/cli/playground/find/manual-test.sh --no-build          # skip the CLI build
#   bash packages/cli/playground/find/manual-test.sh --keep              # keep every run's output
#
# Requires `storyblok login` for the space, `jq`, and `perl`, plus
# `VITE_CLI_FIND_SPACE_ID` in the repository `.env` (or exported, or `--space`).
# It only reads: `find` never writes to the space.
#
# Everything printed is also written, without colors, to `manual-test_debug.txt`
# next to this script, along with each run's exit code, stderr and stdout. stdout
# is cut to 50 lines per run; set `DEBUG_LINES=0` to keep all of it.

set -uo pipefail

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HARNESS_DIR/../../../.." && pwd)"
CLI_DIR="$REPO_ROOT/packages/cli"
CLI_ENTRY="$CLI_DIR/dist/index.mjs"

if [[ -z "${VITE_CLI_FIND_SPACE_ID:-}" && -f "$REPO_ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091  # path is only known at runtime
  source "$REPO_ROOT/.env"
  set +a
fi
SPACE="${VITE_CLI_FIND_SPACE_ID:-}"
SCOPE=""
DO_BUILD=1
LIST_ONLY=0
KEEP=0
SELECTORS=()
ORIG_ARGS=("$@")

while [[ $# -gt 0 ]]; do
  case "$1" in
    --space) SPACE="$2"; shift 2 ;;
    --scope) SCOPE="$2"; shift 2 ;;
    --no-build) DO_BUILD=0; shift ;;
    --list) LIST_ONLY=1; shift ;;
    --keep) KEEP=1; shift ;;
    -h|--help) sed -n '2,32p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) echo "unknown flag: $1" >&2; exit 2 ;;
    *) SELECTORS+=("$1"); shift ;;
  esac
done

BOLD=$'\033[1m'; DIM=$'\033[2m'; RESET=$'\033[0m'
RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; CYAN=$'\033[36m'

# Sections run in this order. Each is a function named `section_<name>`.
SECTIONS=(usage contract server-filters where sort-limit pipes capi-filter check-references)

section_description() {
  case "$1" in
    usage) echo "Invalid input fails as a usage error (exit 2) before a story is read" ;;
    contract) echo "Every line is a story with id, uuid and full_slug; stderr carries the rest" ;;
    server-filters) echo "API filters keep exactly the stories the listing says they should" ;;
    where) echo "--where agrees with the server filters and sees only what is fetched" ;;
    sort-limit) echo "--sort order survives the concurrent fetch; --limit stops cleanly" ;;
    pipes) echo "A reader that leaves ends the run at 0, and early" ;;
    capi-filter) echo "--capi-filter and --capi-params never change the result set" ;;
    check-references) echo "Reference issues, issue-type filters, --limit, and the CDN source" ;;
  esac
}

if [[ $LIST_ONLY -eq 1 ]]; then
  for name in "${SECTIONS[@]}"; do
    printf "  %s%-17s%s %s\n" "$BOLD" "$name" "$RESET" "$(section_description "$name")"
  done
  exit 0
fi

# The whole run is mirrored into DEBUG_LOG, without colors. The script re-runs
# itself behind a filter so terminal output and the per-run details (lines
# prefixed with \x01, which only the log gets) stay in order.
DEBUG_LOG="$HARNESS_DIR/manual-test_debug.txt"
DEBUG_LINES="${DEBUG_LINES:-50}"
if [[ -z "${MANUAL_TEST_LOGGED:-}" ]]; then
  MANUAL_TEST_LOGGED=1 bash "${BASH_SOURCE[0]}" ${ORIG_ARGS[@]+"${ORIG_ARGS[@]}"} 2>&1 \
    | perl -e '
        $| = 1;
        open(my $log, ">", $ARGV[0]) or die "cannot write $ARGV[0]: $!\n";
        $log->autoflush(1);
        while (my $line = <STDIN>) {
          print STDOUT $line unless $line =~ s/^\x01//;
          $line =~ s/\e\[[0-9;]*m//g;
          print $log $line;
        }' "$DEBUG_LOG"
  exit "${PIPESTATUS[0]}"
fi

command -v jq >/dev/null || { echo "${RED}jq is required${RESET}" >&2; exit 1; }
command -v perl >/dev/null || { echo "${RED}perl is required${RESET}" >&2; exit 1; }
[[ -n "$SPACE" ]] || {
  echo "${RED}no space id: set VITE_CLI_FIND_SPACE_ID in $REPO_ROOT/.env, or pass --space${RESET}" >&2
  exit 1
}

if [[ $DO_BUILD -eq 1 ]]; then
  echo "${DIM}Building the CLI...${RESET}"
  (cd "$REPO_ROOT" && pnpm nx build storyblok >/dev/null 2>&1) || {
    echo "${RED}build failed: run \`pnpm nx build storyblok\` to see why${RESET}" >&2
    exit 1
  }
fi
[[ -f "$CLI_ENTRY" ]] || { echo "${RED}no CLI build at $CLI_ENTRY${RESET}" >&2; exit 1; }

# Everything a run writes lands here, including each run's report and log (`-p`),
# so the repository stays clean.
WORK="$REPO_ROOT/.storyblok/find-manual-test"
rm -rf "$WORK"
mkdir -p "$WORK"

PASSED=0; FAILED=0; SKIPPED=0
FAILURES=()
RUN_N=0
OUT=""; ERR=""; CODE=0; DURATION_MS=0; LINES=0; LAST_CMD=""; BASELINE_CMD=""; SCOPED_CMD=""

now_ms() { perl -MTime::HiRes=time -e 'printf "%d\n", time * 1000'; }

# ---------------------------------------------------------------------------
# Running the command
# ---------------------------------------------------------------------------

# Prints the command a check is about to judge, set off from the checks above.
show_cmd() {
  LAST_CMD="$1"
  printf "\n  %s\$ %s%s\n" "$DIM" "$LAST_CMD" "$RESET"
}

# Runs `stories find` with the given flags. Sets OUT/ERR (file paths), CODE,
# LINES (stdout line count) and DURATION_MS.
find_run() {
  RUN_N=$((RUN_N + 1))
  OUT="$WORK/$RUN_N.jsonl"
  ERR="$WORK/$RUN_N.stderr"
  show_cmd "storyblok stories find -s $SPACE $(printf '%q ' "$@")"
  local start
  start=$(now_ms)
  node "$CLI_ENTRY" stories find -s "$SPACE" -p "$WORK/run-$RUN_N" "$@" >"$OUT" 2>"$ERR"
  CODE=$?
  DURATION_MS=$(( $(now_ms) - start ))
  LINES=$(grep -c '' "$OUT" || true)
  log_run
}

# Same, with stdout piped into `$1` (a shell snippet such as "head -2"). CODE is
# the exit code of `find` itself, not of the reader.
find_piped() {
  local reader="$1"; shift
  RUN_N=$((RUN_N + 1))
  OUT="$WORK/$RUN_N.jsonl"
  ERR="$WORK/$RUN_N.stderr"
  show_cmd "storyblok stories find -s $SPACE $(printf '%q ' "$@")| $reader"
  local start
  start=$(now_ms)
  node "$CLI_ENTRY" stories find -s "$SPACE" -p "$WORK/run-$RUN_N" "$@" 2>"$ERR" \
    | eval "$reader" >"$OUT"
  CODE=${PIPESTATUS[0]}
  DURATION_MS=$(( $(now_ms) - start ))
  LINES=$(grep -c '' "$OUT" || true)
  log_run
}

# Keeps the current run's stdout under a name, for comparing against later runs.
save_as() { cp "$OUT" "$WORK/$1.jsonl"; }
saved() { echo "$WORK/$1.jsonl"; }

# Writes the current run's exit code, stderr and stdout to DEBUG_LOG only.
# stdout is cut to DEBUG_LINES lines (0 keeps all of it).
log_run() {
  {
    printf "    ── run %s: exit %s, %s line(s) on stdout, %sms\n" "$RUN_N" "$CODE" "$LINES" "$DURATION_MS"
    if [[ -s "$ERR" ]]; then
      echo "    ── stderr"
      sed 's/^/    /' "$ERR"
    fi
    if [[ -s "$OUT" ]]; then
      if [[ "$DEBUG_LINES" -gt 0 && "$LINES" -gt "$DEBUG_LINES" ]]; then
        echo "    ── stdout (first $DEBUG_LINES of $LINES lines)"
        head -n "$DEBUG_LINES" "$OUT" | sed 's/^/    /'
      else
        echo "    ── stdout"
        sed 's/^/    /' "$OUT"
      fi
    fi
  } | perl -pe 's/^/\x01/'
}

# ---------------------------------------------------------------------------
# Assertions
# ---------------------------------------------------------------------------

pass() { PASSED=$((PASSED + 1)); printf "  %s✔%s %s\n" "$GREEN" "$RESET" "$1"; }
skip() { SKIPPED=$((SKIPPED + 1)); printf "  %s○ %s — skipped: %s%s\n" "$YELLOW" "$1" "$2" "$RESET"; }
fail() {
  FAILED=$((FAILED + 1))
  FAILURES+=("$CURRENT_SECTION: $1")
  printf "  %s✘ %s%s\n" "$RED" "$1" "$RESET"
  printf "    %s\$ %s%s\n" "$DIM" "$LAST_CMD" "$RESET"
  printf "    %sexit %s, %s line(s) on stdout, %sms%s\n" "$DIM" "$CODE" "$LINES" "$DURATION_MS" "$RESET"
  if [[ -s "$ERR" ]]; then
    # The last few stderr lines usually carry the error or the summary.
    grep -v '^\s*$' "$ERR" | tail -6 | sed "s/^/    ${DIM}│ /; s/\$/${RESET}/"
  fi
}

# check "<description>" <predicate> [args...]
check() {
  local description="$1"; shift
  if "$@"; then pass "$description"; else fail "$description"; fi
}

code_is() { [[ "$CODE" -eq "$1" ]]; }
code_not() { [[ "$CODE" -ne "$1" ]]; }
lines_is() { [[ "$LINES" -eq "$1" ]]; }
lines_ge() { [[ "$LINES" -ge "$1" ]]; }
stdout_empty() { [[ ! -s "$OUT" ]]; }
stderr_has() { grep -qF -- "$1" "$ERR"; }
stderr_lacks() { ! grep -qF -- "$1" "$ERR"; }
faster_than() { [[ "$DURATION_MS" -lt "$1" ]]; }

# Every stdout line parses as JSON and satisfies the jq boolean expression.
all_lines() {
  [[ -s "$OUT" ]] || return 0
  jq -e -s --arg x "${2:-}" "all(.[]; $1)" "$OUT" >/dev/null 2>&1
}
# No stdout line satisfies it.
no_lines() {
  [[ -s "$OUT" ]] || return 0
  jq -e -s --arg x "${2:-}" "any(.[]; $1) | not" "$OUT" >/dev/null 2>&1
}

ids_of() { jq -r '.id' "$1" 2>/dev/null; }
# Same stories, in the same order.
same_ids_ordered() { diff <(ids_of "$1") <(ids_of "$2") >/dev/null; }
# Same stories, in any order.
same_ids() { diff <(ids_of "$1" | sort) <(ids_of "$2" | sort) >/dev/null; }
# Every story in $1 is also in $2.
ids_subset() { [[ -z "$(comm -23 <(ids_of "$1" | sort) <(ids_of "$2" | sort))" ]]; }
# Exactly N stories match a jq filter over a file.
count_in() { jq -s "map(select($2)) | length" "$1"; }

# ---------------------------------------------------------------------------
# Discovery: what this space has to test against
# ---------------------------------------------------------------------------

discover() {
  printf "\n%sReading the space...%s\n" "$DIM" "$RESET"
  find_run --skip-content
  if ! code_is 0 || ! lines_ge 1; then
    printf "%sThe metadata listing failed (exit %s), so nothing else can run.%s\n" "$RED" "$CODE" "$RESET"
    grep -v '^\s*$' "$ERR" | tail -8
    exit 1
  fi
  save_as baseline
  BASELINE_CMD="$LAST_CMD"
  BASELINE="$(saved baseline)"
  TOTAL=$LINES

  # The content-fetching checks run inside one subtree small enough to fetch in
  # seconds: the smallest top-level folder holding 5 to 40 stories.
  if [[ -z "$SCOPE" ]]; then
    SCOPE=$(jq -rs '
      map(select(.is_folder != true) | .full_slug | split("/"))
      | map(select(length > 1) | .[0]) | group_by(.) | map({key: .[0], n: length})
      | (map(select(.n >= 5 and .n <= 40)) | sort_by(.n) | .[0].key)
        // (sort_by(.n) | map(select(.n >= 2)) | .[0].key) // empty' "$BASELINE")
  fi
  SCOPE_COUNT=0
  if [[ -n "$SCOPE" ]]; then
    SCOPE_COUNT=$(jq -s --arg s "$SCOPE/" 'map(select(.full_slug | startswith($s))) | length' "$BASELINE")
  fi

  CONTENT_TYPE=$(jq -rs 'map(select(.is_folder != true) | .content_type // empty)
    | group_by(.) | max_by(length) | .[0] // empty' "$BASELINE")
  TAG=$(jq -rs 'map(.tag_list // [] | .[]) | group_by(.) | max_by(length) | .[0] // empty' "$BASELINE")
  STAGE_ID=$(jq -rs 'map(.stage.workflow_stage_id // empty) | .[0] // empty' "$BASELINE")
  FOLDERS=$(count_in "$BASELINE" '.is_folder == true')
  CHANGED=$(count_in "$BASELINE" '.published == true and .unpublished_changes == true')

  printf "  space %s%s%s: %s entries (%s folders, %s with unpublished changes)\n" \
    "$BOLD" "$SPACE" "$RESET" "$TOTAL" "$FOLDERS" "$CHANGED"
  printf "  content-check scope: %s%s%s (%s entries)\n" "$BOLD" "${SCOPE:-none}" "$RESET" "$SCOPE_COUNT"
  printf "  content type: %s  ·  tag: %s  ·  workflow stage: %s\n" \
    "${CONTENT_TYPE:-none}" "${TAG:-none}" "${STAGE_ID:-none}"

  # One full content read of the scope, reused by every section that needs to
  # know what is inside the stories.
  SCOPED=""
  NESTED_BLOCK=""; SECOND_BLOCK=""; TERM=""; REF_SOURCE=""; REF_TARGET=""
  if [[ -n "$SCOPE" ]]; then
    find_run --starts-with "$SCOPE/"
    if code_is 0; then
      save_as scoped
      SCOPED_CMD="$LAST_CMD"
      SCOPED="$(saved scoped)"
      # A block used below the root somewhere in scope, but not in every story.
      local blocks
      blocks=$(jq -rs '
        (map(select(.content) | [.content | .. | objects | .component? // empty] | .[1:] | unique)) as $per
        | ($per | length) as $n
        | [$per[][]] | group_by(.) | map({b: .[0], n: length})
        | map(select(.n < $n)) | sort_by(-.n) | map(.b) | .[0:2] | .[]' "$SCOPED")
      NESTED_BLOCK=$(sed -n 1p <<<"$blocks")
      SECOND_BLOCK=$(sed -n 2p <<<"$blocks")
      # A word from a story name, for the free-text search.
      TERM=$(jq -rs 'map(select(.is_folder != true) | .name // "" | splits("[^A-Za-z]+")
        | select(length >= 4)) | .[0] // empty' "$SCOPED")
      # A story linking to another story, for --references.
      local ref
      ref=$(jq -rs 'map({id, t: ([.content | .. | objects
          | select(.linktype? == "story" and ((.id? // "") | test("^[0-9a-f-]{36}$"))) | .id] | .[0])})
        | map(select(.t)) | .[0] | "\(.id) \(.t)" // empty' "$SCOPED")
      REF_SOURCE=${ref%% *}; REF_TARGET=${ref#* }
      [[ "$ref" == "null null" || -z "$ref" ]] && { REF_SOURCE=""; REF_TARGET=""; }
    fi
  fi
  printf "  nested blocks: %s, %s  ·  search term: %s  ·  a story link: %s\n" \
    "${NESTED_BLOCK:-none}" "${SECOND_BLOCK:-none}" "${TERM:-none}" "${REF_TARGET:-none}"
}

needs() {
  # needs "<check>" VAR... : skips the check when a prerequisite is empty.
  local description="$1"; shift
  local var
  for var in "$@"; do
    if [[ -z "${!var:-}" ]]; then
      skip "$description" "the space has no $(echo "$var" | tr 'A-Z_' 'a-z ')"
      return 1
    fi
  done
  return 0
}

# ---------------------------------------------------------------------------
# Sections
# ---------------------------------------------------------------------------

# Each usage error must exit 2 and print nothing on stdout.
usage_error() {
  local description="$1" expect="$2"; shift 2
  find_run "$@"
  if code_is 2 && stdout_empty && stderr_has "$expect"; then
    pass "$description"
  else
    fail "$description (expected exit 2 and \"$expect\")"
  fi
}

section_usage() {
  local where='$..[?(@.component == "x")]'
  usage_error "--limit 0" "--limit expects" --limit 0
  usage_error "--limit abc" "--limit expects" --limit abc
  usage_error "--query with no clause" "--query is empty" --query ""
  usage_error "--query made of separators" "has no clauses" --query "&&"
  usage_error "--query as an empty JSON object" "has no clauses" --query "{}"
  usage_error "--query with an unknown operator ([eq])" "Unknown --query operation" --query "[category][eq]=news"
  usage_error "--query that is not a query" "Invalid --query clause" --query "not-a-query"
  usage_error "--query with broken JSON" "Invalid --query JSON" --query '{"a":'
  usage_error "--query JSON with a flat field" "object of operations" --query '{"component":"page"}'
  usage_error "--container-block and --query both set component" "Conflicting filters" \
    --container-block page --query "[component][in]=post"
  usage_error "--references with a non-UUID" "--references expects" --references hello
  usage_error "--workflow-stage with a name" "--workflow-stage expects" --workflow-stage review
  usage_error "--sort with a mistyped direction" "Invalid --sort value" --sort updated_at:des
  usage_error "--sort with no field" "Invalid --sort value" --sort ":asc"
  usage_error "--check-references with an unknown type" "--check-references accepts" --check-references missing
  usage_error "--skip-content with --check-references" "cannot be combined" --skip-content --check-references
  usage_error "--capi-params without --capi-filter" "has no effect" --capi-params version=published
  usage_error "--capi-filter without --where" "needs at least one --where" --capi-filter
  usage_error "--capi-filter with an __i18n__ predicate" "field-level translations" \
    --capi-filter --where '$[?($.content.title__i18n__de)]'
  usage_error "--capi-filter --check-references with an __i18n__ predicate" "field-level translations" \
    --capi-filter --check-references --where '$[?($.content.title__i18n__de)]'
  usage_error "--capi-params version=published without a published scope" "needs --publish-status" \
    --capi-filter --capi-params version=published --where "$where"
  usage_error "--capi-params setting a reserved param" 'cannot set "per_page"' \
    --capi-filter --capi-params per_page=100 --where "$where"
  usage_error "--capi-params that parse as nothing" "Invalid --capi-params" \
    --capi-filter --capi-params published --where "$where"
  usage_error "--where that does not compile" "Invalid --where JSONPath" --where '$[?'

  # Commander rejects these itself, with its own exit code; what matters is
  # that nothing runs and stdout stays empty.
  find_run --entry-type bogus
  check "--entry-type outside its choices fails with nothing on stdout" eval 'code_not 0 && stdout_empty'
  find_run --publish-status bogus
  check "--publish-status outside its choices fails with nothing on stdout" eval 'code_not 0 && stdout_empty'
}

section_contract() {
  CODE=0; LINES=$TOTAL; OUT="$BASELINE"; ERR="$WORK/1.stderr"
  show_cmd "$BASELINE_CMD"
  check "the metadata listing exits 0" code_is 0
  check "every line is JSON with id, uuid and full_slug" \
    all_lines '(.id | type == "number") and (.uuid | type == "string") and (.full_slug | type == "string")'
  check "--skip-content lines carry no content" no_lines 'has("content")'
  check "the stderr summary counts what stdout holds" stderr_has "Results: $TOTAL stories"
  check "every story appears once" eval '[[ -z "$(ids_of "$BASELINE" | sort | uniq -d)" ]]'

  if needs "a default run carries content" SCOPED; then
    OUT="$SCOPED"; LINES=$(grep -c '' "$SCOPED")
    show_cmd "$SCOPED_CMD"
    check "a default run carries content on every story" all_lines '.is_folder == true or (.content | type == "object")'
    check "a default run matches the listing's scope" eval '[[ "$LINES" -eq "$SCOPE_COUNT" ]]'
  fi

  find_run --skip-content --no-ui-enabled
  check "--no-ui-enabled leaves stdout unchanged" eval '[[ "$LINES" -eq "$TOTAL" ]]'
  check "--no-ui-enabled prints no summary" stderr_lacks "Results:"
}

section_server-filters() {
  if needs "--container-block" CONTENT_TYPE; then
    local expected
    expected=$(count_in "$BASELINE" ".content_type == \"$CONTENT_TYPE\" and .is_folder != true")
    find_run --container-block "$CONTENT_TYPE" --skip-content
    save_as container
    check "--container-block $CONTENT_TYPE keeps exactly that content type ($expected)" \
      eval "code_is 0 && lines_is $expected && all_lines '.content_type == \"$CONTENT_TYPE\"'"
    find_run --query "[component][in]=$CONTENT_TYPE" --skip-content
    check "--query [component][in]=$CONTENT_TYPE matches --container-block" \
      eval 'code_is 0 && same_ids "$OUT" "$(saved container)"'
    find_run --query "{\"component\":{\"in\":\"$CONTENT_TYPE\"}}" --skip-content
    check "--query in JSON form matches the bracket form" \
      eval 'code_is 0 && same_ids "$OUT" "$(saved container)"'
  fi

  if needs "--tag" TAG; then
    local expected
    expected=$(count_in "$BASELINE" "(.tag_list // []) | index(\"$TAG\")")
    find_run --tag "$TAG" --skip-content
    check "--tag $TAG keeps exactly the tagged stories ($expected)" \
      eval "code_is 0 && lines_is $expected && all_lines '(.tag_list // []) | index(\"$TAG\")'"
  fi

  if needs "--workflow-stage" STAGE_ID; then
    find_run --workflow-stage "$STAGE_ID" --skip-content
    check "--workflow-stage $STAGE_ID keeps only stories at that stage" \
      eval "code_is 0 && lines_ge 1 && all_lines '.stage.workflow_stage_id == $STAGE_ID'"
  fi

  find_run --entry-type folder --skip-content
  check "--entry-type folder keeps exactly the folders ($FOLDERS)" \
    eval "code_is 0 && lines_is $FOLDERS && all_lines '.is_folder == true'"
  find_run --entry-type story --skip-content
  check "--entry-type story keeps no folder" \
    eval "code_is 0 && lines_is $((TOTAL - FOLDERS)) && no_lines '.is_folder == true'"

  find_run --publish-status changed --skip-content
  check "--publish-status changed keeps published stories with pending edits ($CHANGED)" \
    eval "code_is 0 && lines_is $CHANGED && all_lines '.published == true and .unpublished_changes == true'"
  find_run --publish-status published --skip-content
  check "--publish-status published keeps live stories without pending edits" \
    eval "code_is 0 && all_lines '.published == true and .unpublished_changes != true'"
  find_run --publish-status draft --skip-content
  check "--publish-status draft keeps unpublished stories only" \
    eval "code_is 0 && no_lines '.published == true'"

  if needs "--starts-with" SCOPE; then
    find_run --starts-with "$SCOPE/" --skip-content
    save_as scope-meta
    check "--starts-with $SCOPE keeps the subtree ($SCOPE_COUNT)" \
      eval "code_is 0 && lines_is $SCOPE_COUNT && all_lines '.full_slug | startswith(\"$SCOPE/\")'"
    find_run --starts-with "/$SCOPE/" --skip-content
    check "a leading slash on --starts-with is ignored" eval 'code_is 0 && same_ids "$OUT" "$(saved scope-meta)"'
  fi

  if needs "--includes-block" SCOPED NESTED_BLOCK; then
    local expected_file="$WORK/includes-expected.jsonl"
    jq -c --arg b "$NESTED_BLOCK" 'select([.content | .. | objects | .component?] | index($b))' "$SCOPED" >"$expected_file"
    find_run --starts-with "$SCOPE/" --includes-block "$NESTED_BLOCK" --skip-content
    save_as includes
    check "--includes-block $NESTED_BLOCK keeps the stories using it at any depth" \
      eval 'code_is 0 && lines_ge 1 && same_ids "$OUT" "$expected_file"'

    if [[ -n "$SECOND_BLOCK" ]]; then
      jq -c --arg a "$NESTED_BLOCK" --arg b "$SECOND_BLOCK" \
        'select([.content | .. | objects | .component?] | (index($a) and index($b)))' "$SCOPED" >"$expected_file"
      find_run --starts-with "$SCOPE/" --includes-block "$NESTED_BLOCK,$SECOND_BLOCK" --skip-content
      check "--includes-block a,b keeps stories using both (AND)" eval 'code_is 0 && same_ids "$OUT" "$expected_file"'
    fi
  fi

  if needs "free-text search" SCOPED TERM; then
    find_run "$TERM" --starts-with "$SCOPE/"
    check "searching \"$TERM\" finds it in each story's name, slug or content" \
      eval "code_is 0 && lines_ge 1 && all_lines 'tojson | ascii_downcase | contains(\$x | ascii_downcase)' '$TERM'"
  fi

  if needs "--references" REF_TARGET; then
    find_run --references "$REF_TARGET" --skip-content
    check "--references $REF_TARGET includes the story that links to it" \
      eval "code_is 0 && [[ -n \"\$(jq -r 'select(.id == $REF_SOURCE) | .id' \"\$OUT\")\" ]]"
  fi
}

section_where() {
  find_run --skip-content --where '$..[?(@.component == "__manual_test_no_such_block__")]'
  check "a --where matching nothing exits 0 with no lines" eval 'code_is 0 && lines_is 0'

  if needs "--where on metadata" SCOPE; then
    find_run --skip-content --where "\$[?search(\$.full_slug, '^$SCOPE/')]"
    check "--where on metadata works under --skip-content" \
      eval 'code_is 0 && same_ids "$OUT" "$(saved scope-meta)"'
  fi

  if needs "--where against the server filter" SCOPED NESTED_BLOCK; then
    local expression="\$..[?(@.component == '$NESTED_BLOCK')]"
    find_run --starts-with "$SCOPE/" --where "$expression"
    save_as where-block
    check "--where on a nested block agrees with --includes-block" \
      eval 'code_is 0 && same_ids "$OUT" "$(saved includes)"'

    # The listing's content_summary must not leak a content match through.
    find_run --starts-with "$SCOPE/" --skip-content --where "$expression"
    check "a content --where under --skip-content matches nothing, and says why" \
      eval 'code_is 0 && lines_is 0 && stderr_has "sees list metadata only"'
    find_run --starts-with "$SCOPE/" --skip-content --where '$..[?(@.component)]'
    check "--where never matches on content_summary" eval 'code_is 0 && lines_is 0'

    if [[ -n "$SECOND_BLOCK" ]]; then
      local second="\$..[?(@.component == '$SECOND_BLOCK')]"
      local expected_file="$WORK/where-and.jsonl"
      jq -c --arg a "$NESTED_BLOCK" --arg b "$SECOND_BLOCK" \
        'select([.content | .. | objects | .component?] | (index($a) and index($b)))' "$SCOPED" >"$expected_file"
      find_run --starts-with "$SCOPE/" --where "$expression" --where "$second"
      check "several --where expressions combine with AND" eval 'code_is 0 && same_ids "$OUT" "$expected_file"'
    fi
  fi
}

section_sort-limit() {
  local sorted='[.[].created_at] as $d | $d == ($d | sort)'
  find_run --skip-content --sort created_at:asc
  check "--sort created_at:asc on the listing is ascending" \
    eval "code_is 0 && lines_is $TOTAL && jq -e -s '$sorted' \"\$OUT\" >/dev/null"
  find_run --skip-content --sort updated_at:desc
  check "--sort updated_at:desc on the listing is descending" \
    eval "code_is 0 && jq -e -s '[.[].updated_at] as \$d | \$d == (\$d | sort | reverse)' \"\$OUT\" >/dev/null"

  if needs "--sort across the concurrent content fetch" SCOPE; then
    find_run --starts-with "$SCOPE/" --skip-content --sort created_at:asc
    save_as scope-sorted
    find_run --starts-with "$SCOPE/" --sort created_at:asc
    check "--sort order survives the concurrent content fetch" \
      eval 'code_is 0 && same_ids_ordered "$OUT" "$(saved scope-sorted)"'
    find_run --starts-with "$SCOPE/" --sort created_at:asc --limit 3
    check "--sort with --limit 3 returns the top 3" \
      eval 'code_is 0 && lines_is 3 && same_ids_ordered "$OUT" <(head -3 "$(saved scope-sorted)")'
  fi

  find_run --limit 3
  check "--limit 3 writes exactly 3 lines and exits 0" eval 'code_is 0 && lines_is 3'
  check "--limit reports the stop as deliberate" stderr_has "Stopped early on purpose: --limit 3"
  check "--limit is not reported as an error" stderr_lacks "aborted"

  find_run --skip-content --limit "$((TOTAL + 10))"
  check "--limit above the result count returns everything" eval 'code_is 0 && lines_is $TOTAL'

  find_run --skip-content --sort __manual_test_no_such_column__:asc
  check "an unsortable --sort column fails and names the flag" \
    eval 'code_not 0 && stderr_has "Incomplete results" && stderr_has "names a column the API cannot sort by"'
}

section_pipes() {
  find_piped "head -2" --skip-content
  check "| head -2 gets 2 lines and find exits 0" eval 'code_is 0 && lines_is 2'

  # A default run fetches content one story at a time, so a whole large space
  # would take minutes: stopping early is what keeps this quick.
  find_piped "head -1"
  check "| head -1 on a content run exits 0" code_is 0
  if [[ "$TOTAL" -gt 150 ]]; then
    check "| head -1 stops the run instead of reading all $TOTAL stories" faster_than 20000
  fi
  check "a closed pipe is reported as deliberate" stderr_has "closed the pipe"

  find_piped "jq -r .id" --skip-content
  check "the output pipes into jq line by line" eval 'code_is 0 && lines_is $TOTAL'
}

section_capi-filter() {
  if ! needs "--capi-filter" SCOPED NESTED_BLOCK; then
    return
  fi
  local expression="\$..[?(@.component == '$NESTED_BLOCK')]"

  find_run --starts-with "$SCOPE/" --capi-filter --where "$expression"
  check "--capi-filter returns the same stories as without it" \
    eval 'code_is 0 && same_ids_ordered "$OUT" "$(saved where-block)"'
  check "--capi-filter still emits Management API content" \
    eval "all_lines '.content | type == \"object\"' && no_lines 'tojson | contains(\"_editable\")'"

  find_run --starts-with "$SCOPE/" --capi-filter --skip-content --where "$expression"
  check "--capi-filter --skip-content returns the same stories, as metadata" \
    eval 'code_is 0 && same_ids_ordered "$OUT" "$(saved where-block)" && no_lines "has(\"content\")"'

  find_run --starts-with "$SCOPE/" --capi-filter --where '$..[?(@.component == "__manual_test_no_such_block__")]'
  check "--capi-filter matching nothing exits 0 with no lines" eval 'code_is 0 && lines_is 0'

  find_run --starts-with "$SCOPE/" --capi-filter --capi-params "zzz_manual_test=1" --where "$expression"
  if code_is 0; then
    skip "--capi-params the CDN rejects fails with its reason" "the CDN accepted an unknown parameter"
  else
    check "--capi-params the CDN rejects fails as a usage error, with its reason" \
      eval 'code_is 2 && stdout_empty && stderr_has "The CDN rejected --capi-params"'
  fi

  find_run --starts-with "$SCOPE/" --capi-filter --publish-status published \
    --capi-params version=published --where "$expression"
  check "--capi-params version=published runs with a published scope" \
    eval 'code_is 0 && all_lines ".published == true"'

  find_run --starts-with "$SCOPE/" --capi-filter --capi-params '{lang: default}' --where "$expression"
  check "the lang alias is accepted as language" code_is 0
}

section_check-references() {
  if ! needs "--check-references" SCOPE; then
    return
  fi
  local types='["broken","unpublished","stale_url"]'

  find_run --starts-with "$SCOPE/" --check-references
  save_as refs-all
  local all=$LINES
  check "--check-references exits 0 and loads the schema" eval 'code_is 0 && stderr_has "Loaded"'
  check "every reported story carries a non-empty _ref_issues" \
    all_lines "(._ref_issues | length > 0) and all(._ref_issues[]; .type as \$t | $types | index(\$t))"
  check "every issue names its field and target" \
    all_lines 'all(._ref_issues[]; (.field_path | startswith("content")) and (.target_uuid | length == 36))'
  if [[ "$all" -eq 0 ]]; then
    skip "the issue-type and --limit checks" "no reference issues in $SCOPE; try another --scope"
    return
  fi

  find_run --starts-with "$SCOPE/" --check-references broken
  save_as refs-broken
  check "--check-references broken reports only broken references" \
    eval 'code_is 0 && all_lines "all(._ref_issues[]; .type == \"broken\")" && ids_subset "$OUT" "$(saved refs-all)"'
  find_run --starts-with "$SCOPE/" --check-references --where "\$._ref_issues[?(@.type == 'broken')]"
  check "--check-references broken matches the equivalent --where" \
    eval 'code_is 0 && same_ids "$OUT" "$(saved refs-broken)"'
  find_run --starts-with "$SCOPE/" --check-references unpublished,stale_url
  check "--check-references unpublished,stale_url reports no broken reference" \
    eval 'code_is 0 && no_lines "any(._ref_issues[]; .type == \"broken\")"'

  find_run --starts-with "$SCOPE/" --check-references --limit 1
  check "--check-references --limit 1 writes 1 line and exits 0" eval 'code_is 0 && lines_is 1'
  check "--check-references --limit counts only what was written" \
    eval 'stderr_has "Results: 1 stories with reference issues" && stderr_lacks "aborted"'

  find_run --starts-with "$SCOPE/" --check-references --capi-filter
  check "--check-references --capi-filter warns about translated fields" stderr_has "field-level translations"
  # CDN content has no field-level translations, so it can only find fewer.
  check "--check-references --capi-filter finds no issue the MAPI run did not" \
    eval 'code_is 0 && ids_subset "$OUT" "$(saved refs-all)"'
}

# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

selected() {
  [[ ${#SELECTORS[@]} -eq 0 ]] && return 0
  local selector
  for selector in "${SELECTORS[@]}"; do
    [[ "$1" == *"$selector"* ]] && return 0
  done
  return 1
}

START=$(now_ms)
discover

for CURRENT_SECTION in "${SECTIONS[@]}"; do
  selected "$CURRENT_SECTION" || continue
  printf "\n%s%s%s %s— %s%s\n" "$BOLD$CYAN" "$CURRENT_SECTION" "$RESET" "$DIM" \
    "$(section_description "$CURRENT_SECTION")" "$RESET"
  "section_$CURRENT_SECTION"
done

ELAPSED=$(( ($(now_ms) - START) / 1000 ))
printf "\n%s%s passed%s, %s%s failed%s, %s%s skipped%s  %s(%s runs in %ss)%s\n" \
  "$GREEN" "$PASSED" "$RESET" "$RED" "$FAILED" "$RESET" "$YELLOW" "$SKIPPED" "$RESET" \
  "$DIM" "$RUN_N" "$ELAPSED" "$RESET"
if [[ $FAILED -gt 0 ]]; then
  printf "%sFailed:%s\n" "$RED" "$RESET"
  printf "  - %s\n" "${FAILURES[@]}"
fi

if [[ $KEEP -eq 1 ]]; then
  printf "%sEvery run's stdout and stderr: %s%s\n" "$DIM" "$WORK" "$RESET"
else
  rm -rf "$WORK"
fi

printf "%sFull output: %s%s\n" "$DIM" "$DEBUG_LOG" "$RESET"

[[ $FAILED -eq 0 ]]
