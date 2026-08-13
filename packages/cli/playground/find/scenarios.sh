#!/usr/bin/env bash
# Scenario runs for `storyblok stories find` against a real space.
#
# For every scenario it prints the exact command, lets the command's own progress
# bars render live, then reports what came back and where the time went. The
# counts come from the run report the command writes itself and the timings from
# `probe.mjs`, which measures from outside the command rather than from inside it.
# The same results are written to a markdown file at the end.
#
# Usage, from anywhere in the repository:
#   bash packages/cli/playground/find/scenarios.sh                  # every scenario
#   bash packages/cli/playground/find/scenarios.sh 2 4              # by number
#   bash packages/cli/playground/find/scenarios.sh where refs       # by name substring
#   bash packages/cli/playground/find/scenarios.sh --list           # print, run nothing
#   bash packages/cli/playground/find/scenarios.sh --space 12345    # another space
#   bash packages/cli/playground/find/scenarios.sh --report run.md  # markdown output path
#   bash packages/cli/playground/find/scenarios.sh --keep-output    # keep the JSONL + report
#   bash packages/cli/playground/find/scenarios.sh --no-build       # skip the CLI build
#
# Requires `storyblok login` for the space, plus `jq`.

set -uo pipefail

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HARNESS_DIR/../../../.." && pwd)"
CLI_DIR="$REPO_ROOT/packages/cli"
CLI_ENTRY="$CLI_DIR/dist/index.mjs"

# Reference space: "Storyblok Website clone", 3,951 stories + 65 folders, 176
# components, real broken and stale references. The scopes below are sized
# against it, each landing between 160 and 210 server-side matches: enough work
# to measure, still ~30s per scenario at the default 6 req/s.
SPACE="294494468878388"

DO_BUILD=1
LIST_ONLY=0
KEEP_OUTPUT=0
REPORT_MD=""  # defaults under .storyblok/, which is gitignored
SELECTORS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --space) SPACE="$2"; shift 2 ;;
    --report) REPORT_MD="$2"; shift 2 ;;
    --no-build) DO_BUILD=0; shift ;;
    --list) LIST_ONLY=1; shift ;;
    --keep-output) KEEP_OUTPUT=1; shift ;;
    # `\?` is a GNU extension; the bracketed form works on BSD sed too.
    -h|--help) sed -n '2,22p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) echo "unknown flag: $1" >&2; exit 2 ;;
    *) SELECTORS+=("$1"); shift ;;
  esac
done

BOLD=$'\033[1m'; DIM=$'\033[2m'; RESET=$'\033[0m'
RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; CYAN=$'\033[36m'
# Reversed video for the two headers, so a scenario is findable when scrolling
# back through five runs of progress bars.
ON_CYAN=$'\033[46;30;1m'; ON_GREY=$'\033[47;30;1m'

command -v jq >/dev/null || { echo "${RED}jq is required${RESET}" >&2; exit 1; }

# The written report lands in the gitignored cache directory unless asked otherwise,
# so a sweep never leaves the repository dirty.
: "${REPORT_MD:=$REPO_ROOT/.storyblok/find-scenarios-report.md}"

# Each scenario gets its own base directory, so its run report is the only file
# in there and finding it needs no ordering or pruning guesswork.
TMP_BASE="${TMPDIR:-/tmp}"
RUN_DIR="$(mktemp -d "${TMP_BASE%/}/find-scenarios.XXXXXX")"
cleanup() { [[ $KEEP_OUTPUT -eq 1 ]] || rm -rf "$RUN_DIR"; }
trap cleanup EXIT

INDEX=0
COUNTING=0
TOTAL_SCENARIOS=0
SUMMARY_ROWS=()
MD_BLOCKS=()
MD_SUMMARY_ROWS=()

# Renders the argument list the way it would have to be typed, so the printed
# command can be copied straight into a shell. JSONPath expressions are the
# reason this exists: `$..[?(@.component == 'hint')]` needs its quotes back.
# With `color`, flags and their values are told apart by colour as well.
render_args() {
  local mode="$1"; shift
  local rendered="" arg piece
  local single="'" escaped="'\\''"
  for arg in "$@"; do
    if [[ "$arg" =~ ^[A-Za-z0-9_./:=@,-]+$ ]]; then
      piece="$arg"
    else
      piece="'${arg//$single/$escaped}'"
    fi
    if [[ "$mode" == color ]]; then
      case "$arg" in
        -*) piece="${CYAN}${piece}${RESET}" ;;
        *) piece="${YELLOW}${piece}${RESET}" ;;
      esac
    fi
    rendered+=" $piece"
  done
  printf '%s' "${rendered# }"
}

# Padding helpers. Durations arrive already formatted from `stats.mjs`, which is
# where every number in the tables is computed.
JQ_HELPERS='
  def rpad(n): tostring | . + (" " * (n - length));
  def lpad(n): tostring | (" " * (n - length)) + .;
'

# Draws one measured run as a framed panel: the counts as a funnel, then a row per
# stage naming where it runs, since that is the whole point of the command's
# design — MAPI requests first, then work done locally on what came back.
#
# Colour codes are zero width, so every cell is padded as plain text first and
# wrapped afterwards. Full-width bands carry their plain twin for the same reason.
report_block() {
  local view="$1"
  jq -rn --argjson v "$view" \
    --arg b "$BOLD" --arg d "$DIM" --arg r "$RESET" --arg g "$GREEN" \
    --arg y "$YELLOW" --arg e "$RED" --arg c "$CYAN" "$JQ_HELPERS"'
    def dim: $d + . + $r;
    def strong: $b + . + $r;
    def cyan: $c + . + $r;
    def tone: { strong: $b, good: $g, warn: $y, bad: $e }[.] // $b;
    # Column content widths; each cell prints with a space on either side.
    def widths: [19, 19, 15, 8, 8, 9];
    def inner: (widths | add) + (widths | length) * 2 + (widths | length) - 1;

    def edge(left; joint; right):
      (left + ([widths[] | ("─" * (. + 2))] | join(joint)) + right) | dim;
    def frame(left; right): (left + ("─" * inner) + right) | dim;
    def band(plain; painted):
      ("│" | dim) + " " + painted + (" " * (inner - 1 - (plain | length))) + ("│" | dim);
    def cellL(w): " " + rpad(w) + " ";
    def cellR(w): " " + lpad(w) + " ";
    def trow(cells):
      ("│" | dim) + ((cells[0] | cellL(19)) | cyan) + ("│" | dim)
      + ((cells[1] | cellL(19)) | dim) + ("│" | dim)
      + ((cells[2] | cellR(15)) | dim) + ("│" | dim)
      + ((cells[3] | cellR(8)) | strong) + ("│" | dim)
      + ((cells[4] | cellR(8)) | strong) + ("│" | dim)
      + (cells[5] | cellR(9)) + ("│" | dim);
    def hrow(cells):
      ("│" + (cells[0] | cellL(19)) + "│" + (cells[1] | cellL(19)) + "│" + (cells[2] | cellR(15))
        + "│" + (cells[3] | cellR(8)) + "│" + (cells[4] | cellR(8)) + "│" + (cells[5] | cellR(9))
        + "│") | dim;

    ($v.counts | map(.sep + "\(.value) \(.label)") | join("")) as $countsPlain
    | ($v.counts | map((.sep | dim) + (.tone | tone) + (.value | tostring) + $r + " "
        + (.label | dim)) | join("")) as $countsPainted
    | "wall \($v.wall)s  ·  \($v.rate) req/s rate limit  ·  \($v.parallel) requests in parallel"
        as $footPlain
    | (("wall " | dim) + ("\($v.wall)s" | strong) + ("  ·  " | dim) + ("\($v.rate) req/s" | strong)
        + (" rate limit" | dim) + ("  ·  " | dim) + ($v.parallel | tostring | strong)
        + (" requests in parallel" | dim)) as $footPainted
    | [
        frame("╭"; "╮"),
        band($countsPlain; $countsPainted),
        edge("├"; "┬"; "┤"),
        hrow(["stage", "runs", "sampled", "time", "median", "p95"]),
        edge("├"; "┼"; "┤"),
        ($v.stages[] | trow([.stage, .runs, .sampled, .time, .median, .p95])),
        edge("├"; "┴"; "┤"),
        band($footPlain; $footPainted),
        frame("╰"; "╯")
      ] | .[] | "  " + .' 2>/dev/null \
    || printf "    %s(could not measure this run)%s\n" "$YELLOW" "$RESET"
}

# The same numbers as a markdown section for the written report.
markdown_block() {
  local view="$1" index="$2" name="$3" description="$4" command="$5"
  jq -rn --argjson v "$view" --arg index "$index" --arg name "$name" \
    --arg description "$description" --arg command "$command" '
    [
      "## \($index). \($name)",
      "",
      $description,
      "",
      "```bash",
      "storyblok stories find " + $command,
      "```",
      "",
      ($v.counts | map(.sep + "\(.value) \(.label)") | join("") | ltrimstr(" ")),
      "",
      "| stage | runs | sampled | time | median | p95 |",
      "| --- | --- | ---: | ---: | ---: | ---: |",
      ($v.stages[] | "| \(.stage) | \(.runs) | \(.sampled) | \(.time) | \(.median) | \(.p95) |"),
      "",
      "wall \($v.wall)s, \($v.rate) req/s rate limit, \($v.parallel) requests in parallel."
    ] | .[]'
}

# Runs one scenario. `scenarios` below is the readable list of what gets run.
run() {
  local name="$1" description="$2"; shift 2
  local args=("$@")
  INDEX=$((INDEX + 1))

  # A dry pass runs first, only to learn how many scenarios there are, so each
  # header can read "3/5" without the count being maintained by hand.
  [[ $COUNTING -eq 1 ]] && return 0

  if [[ ${#SELECTORS[@]} -gt 0 ]]; then
    local wanted=0 selector
    for selector in "${SELECTORS[@]}"; do
      [[ "$selector" == "$INDEX" || "$name" == *"$selector"* ]] && wanted=1
    done
    [[ $wanted -eq 1 ]] || return 0
  fi

  if [[ $LIST_ONLY -eq 1 ]]; then
    printf "%s %2d %s %s%s%s\n" "$ON_CYAN" "$INDEX" "$RESET" "$BOLD" "$name" "$RESET"
    printf "    %s%s%s\n" "$DIM" "$description" "$RESET"
    printf "    %s$%s storyblok stories find %s-s%s %s%s%s %s\n\n" \
      "$DIM" "$RESET" "$CYAN" "$RESET" "$YELLOW" "$SPACE" "$RESET" \
      "$(render_args color "${args[@]}")"
    return 0
  fi

  local work="$RUN_DIR/$INDEX-$name"
  local out="$work/stories.jsonl"
  mkdir -p "$work"

  printf "\n%s %d/%d %s %s%s%s %s%s%s\n" \
    "$ON_CYAN" "$INDEX" "$TOTAL_SCENARIOS" "$RESET" "$BOLD" "$name" "$RESET" \
    "$DIM" "$(printf '─%.0s' $(seq 1 $((66 - ${#name}))))" "$RESET"
  printf "  %s%s%s\n\n" "$DIM" "$description" "$RESET"
  # The command as a user would type it, plus what this harness adds around it:
  # `-p` moves the run report and log into a scratch directory, and `--import`
  # loads the timing probe.
  printf "  %s$%s %sstoryblok stories find%s %s-s%s %s%s%s %s %s-p %s --import probe.mjs%s\n\n" \
    "$DIM" "$RESET" "$BOLD" "$RESET" "$CYAN" "$RESET" "$YELLOW" "$SPACE" "$RESET" \
    "$(render_args color "${args[@]}")" "$DIM" "$work" "$RESET"

  if [[ ! -t 2 ]]; then
    printf "  %s(progress bars need a terminal on stderr; only the summary follows)%s\n" \
      "$DIM" "$RESET"
  fi

  # stderr is deliberately left alone: the command's own progress bars and
  # summary render live, which is the "what is it doing right now" view. stdout
  # is captured so the JSONL can be counted and kept.
  local exit_code
  FIND_PROBE_OUT="$work/probe.jsonl" \
    node --import "file://$HARNESS_DIR/probe.mjs" \
    "$CLI_ENTRY" stories find -s "$SPACE" "${args[@]}" -p "$work" >"$out"
  exit_code=$?

  local lines report view
  lines=$(wc -l < "$out" | tr -d " ")
  report=$(ls "$work"/reports/"$SPACE"/*.json 2>/dev/null | head -1)

  printf "\n"
  [[ $exit_code -ne 0 ]] && printf "  %sexited %s%s\n\n" "$RED" "$exit_code" "$RESET"

  if [[ -n "$report" ]]; then
    view=$(node "$HARNESS_DIR/stats.mjs" "$work/probe.jsonl" "$report" "$lines")
  fi

  if [[ -n "${view:-}" ]]; then
    report_block "$view"
    SUMMARY_ROWS+=("$(jq -rn --argjson v "$view" --arg name "$name" \
      --arg b "$BOLD" --arg r "$RESET" --arg g "$GREEN" --arg c "$CYAN" "$JQ_HELPERS"'
      "  " + $c + ($name | rpad(20)) + $r
      + ($v.summary.listed | lpad(8))
      + ($v.summary.fetched | lpad(9))
      + $g + $b + ($v.summary.kept | lpad(7)) + $r
      + ($v.summary.content | lpad(10))
      + ($v.summary.median | lpad(9))')")
    MD_BLOCKS+=("$(markdown_block "$view" "$INDEX" "$name" "$description" \
      "-s $SPACE $(render_args plain "${args[@]}")")")
    MD_SUMMARY_ROWS+=("$(jq -rn --argjson v "$view" --arg name "$name" '
      "| \($name) | \($v.summary.listed) | \($v.summary.fetched) | \($v.summary.kept) "
      + "| \($v.summary.content) | \($v.summary.median) |"')")
  else
    printf "  %sno run report was written%s\n" "$YELLOW" "$RESET"
    SUMMARY_ROWS+=("$(printf "  %s%-20s%s%8s%9s%7s%10s%9s" \
      "$CYAN" "$name" "$RESET" "-" "-" "-" "-" "-")")
  fi

  [[ $KEEP_OUTPUT -eq 1 ]] && printf "\n    %skept: %s%s\n" "$DIM" "$work" "$RESET"
  return 0
}

# ── Scenarios ─────────────────────────────────────────────────────────────────
# Every entry is a real invocation, each sized to roughly 150-200 server-side
# matches on the reference space: enough work to measure, ~30s to re-run. Add,
# reorder or edit freely — the shape is `run <name> <description> <args…>`.
#
# The expected counts were taken from a full offline pass over the space and
# confirmed against a real run, so a number that comes back different is either
# content drift or a bug worth looking at.
#
#   faq  178 stories, all of content type `faq`; 34 of them nest a `hint` block
#        somewhere in their body, which is what makes the same scope worth
#        running both with and without `--where`.
#   lp   210 entries: 197 published (6 of those with unpublished changes), ~1,200
#        references, 27 stories with a reference issue — 25 of them holding stale
#        multilink URLs, 2 pointing at unpublished targets. Of its 191 fully
#        published stories, 94 hold a `customers_logos` with six or more logos, 67
#        of those also nest a `card_with_*` block, and 21 of those are
#        `enterprise_page` stories. The faq subtree has almost no references, so
#        the reference check uses this scope rather than one where it finds nothing.
scenarios() {
  run "server-scope" \
    "Server-side filters only: one subtree, stories without folders. Every listed story is fetched and kept. Expect 178 listed, 178 matched." \
    --entry-type story --starts-with faq

  run "where-block" \
    "Same subtree, same fetch cost, narrowed client-side to stories nesting a 'hint' block at any depth. Expect 178 fetched, 34 matched." \
    --entry-type story --starts-with faq \
    --where "\$..[?(@.component == 'hint')]"

  run "client-filters" \
    "Four client-side filters over one subtree, ANDed. --publish-status is decided from the list response, so the 6 stories with unpublished changes are never fetched. The three --where expressions then count a nested block list, match a component name by regular expression, and test a story-level property. Expect 197 listed, 6 skipped before fetch, 191 fetched, 21 matched." \
    --starts-with lp --publish-status published \
    --where "\$..[?(@.component == 'customers_logos' && count(@.logos_list[*]) >= 6)]" \
    --where "\$..[?match(@.component, 'card_with_.*')]" \
    --where "\$[?(\$.content.component == 'enterprise_page')]"

  run "includes-block" \
    "Server-side --includes-block: matches a block used anywhere inside the story, space-wide and resolved by MAPI rather than by fetching content. Expect 167 listed." \
    --includes-block customers_logos

  run "check-references" \
    "Reference integrity: loads the component schema, extracts every link and relation, resolves the targets it has not already listed, then reports the stories with issues. --where runs after that enrichment, which is what lets it select one kind of issue out of the \`_ref_issues\` the check attached. Expect 210 checked, ~274 external targets resolved, 27 with issues, 25 of them stale URLs." \
    --check-references --starts-with lp \
    --where "\$._ref_issues[?(@.type == 'stale_url')]"
}

# ── Run ───────────────────────────────────────────────────────────────────────
COUNTING=1; scenarios; TOTAL_SCENARIOS=$INDEX; COUNTING=0; INDEX=0

if [[ $LIST_ONLY -eq 1 ]]; then
  printf "\n%s stories find %s %s%s scenarios, space %s%s\n\n" \
    "$ON_GREY" "$RESET" "$DIM" "$TOTAL_SCENARIOS" "$SPACE" "$RESET"
  scenarios
  exit 0
fi

if [[ $DO_BUILD -eq 1 ]]; then
  printf "%s⠿ building the CLI...%s\n" "$DIM" "$RESET"
  (cd "$CLI_DIR" && pnpm build >/dev/null 2>&1) \
    || { printf "%s▲ build failed%s\n" "$RED" "$RESET"; exit 1; }
fi

SECONDS=0
printf "\n%s stories find — scenarios %s  %sspace%s %s%s%s  %s%s%s\n" \
  "$ON_GREY" "$RESET" "$DIM" "$RESET" "$YELLOW" "$SPACE" "$RESET" \
  "$DIM" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$RESET"

scenarios

if [[ ${#SUMMARY_ROWS[@]} -gt 0 ]]; then
  SWEEP_WALL=$SECONDS
  RAN=${#SUMMARY_ROWS[@]}
  printf "\n%s summary %s %s%s scenario%s in %ss%s\n\n" \
    "$ON_GREY" "$RESET" "$DIM" "$RAN" "$([[ $RAN -eq 1 ]] || echo s)" "$SWEEP_WALL" "$RESET"
  printf "%s  %-20s%8s%9s%7s%10s%9s%s\n" \
    "$DIM" "scenario" "listed" "fetched" "kept" "content" "median" "$RESET"
  printf '%s\n' "${SUMMARY_ROWS[@]}"

  # Same run, written down: the terminal scrolls away, the markdown is shareable.
  mkdir -p "$(dirname "$REPORT_MD")"
  {
    printf '# `stories find` scenario run\n\n'
    printf -- '- Space: `%s`\n' "$SPACE"
    printf -- '- Date: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf -- '- CLI: %s\n' "$(node "$CLI_ENTRY" --vers 2>/dev/null | tail -1)"
    printf -- '- Scenarios: %s, in %ss\n\n' "$RAN" "$SWEEP_WALL"
    printf '%s\n\n' "${MD_BLOCKS[@]}"
    printf '## Summary\n\n'
    printf '| scenario | listed | fetched | kept | content | median |\n'
    printf '| --- | ---: | ---: | ---: | ---: | ---: |\n'
    printf '%s\n' "${MD_SUMMARY_ROWS[@]}"
    printf '\n`content` is the content stage'"'"'s execution time, `median` one story request '
    printf 'including its wait for a rate-limit slot.\n'
  } > "$REPORT_MD"
  printf "\n%s  report %s%s%s\n" "$DIM" "$RESET" "$CYAN$REPORT_MD" "$RESET"
fi
printf "\n%s✔ done%s\n" "$GREEN" "$RESET"
