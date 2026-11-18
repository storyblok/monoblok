# ADR-0027: CLI Live UI Follows Both Streams

**Status:** Accepted  
**Date:** 2026-11-17  
**Supersedes:** the progress rendering part of ADR-0020 §7, and the spinner behaviour of #739

## Context

The CLI's live UI is progress bars (`cli-progress`) and spinners (`@topcli/spinner`). Both animate
by moving the cursor back over what they drew. They write to stderr, and results go to stdout.

ADR-0020 §7 kept the bars on whenever stderr was a terminal. It dropped them only when stdout was a
terminal too, the one collision it called observable. It rejected acting on what a downstream reader
does with its output, since "whether the downstream command prints to the terminal or to a file is a
property of that command".

That assumption fails in the common case. In `stories find … | jq`, `jq` prints to the same terminal
as the bars, and each redraw moves the cursor back over lines `jq` has just printed. With
`--limit 5`, the CLI wrote all five results and two of them were overwritten on screen. The summary
then reported five, and the output looked like a bug in the limit.

Separately, #739 replaced the spinner's `verbose: !isVitest` with the global `--verbose`, to remove
test-environment detection from production code. `@topcli/spinner` writes nothing at all with
`verbose: false`, so every spinner in the CLI went silent unless `--verbose` was passed. A slow
request then showed nothing until it finished or failed.

## Decision

**Live UI draws only when stderr is a terminal and stdout is not a pipe.** A pipe almost always
leads to a reader that prints to the same terminal (`jq`, `grep`, `less`), and the CLI can't tell
the exceptions apart. A redirect to a file or a device (`> out.jsonl`, `> /dev/null`) has no such
reader, so it keeps the live UI. The check lives in `UI.canRedraw` and covers bars and spinners
alike.

Without live UI, nothing about the run is hidden: a spinner prints its title once and its outcome
once (the plain spinner), and the stage summary prints after the run as before.

**Spinners show whether or not `--verbose` is set.** A spinner is progress, not diagnostics.
`--verbose` keeps its meaning: more detail on errors and in the logs.

**Stopping no bars writes nothing.** `MultiBar.stop()` ends the line and restores the cursor even
when it never drew a bar, which left a stray blank line on every run without bars.

## Consequences

- `find … | jq` prints clean results. The rest of ADR-0020 §7 stands: results stream as they are
  produced, and stdout never waits for the UI. Bars draw when both streams are terminals.
- `find … | jq … > out.jsonl` runs without live progress, though nothing would have been garbled:
  the CLI sees a pipe either way. The stage summary still prints at the end. Passing
  `--no-ui-enabled` remains the way to silence stderr entirely.
- The rule applies to every command that uses `getUI()`, not only `stories find`.
- Spinner output in tests is controlled by mocking the UI or the stream targets, never by detecting
  the test runner, which keeps #739's intent.

## Alternatives Considered

- **Keep §7 and leave it to the user** (`2>/dev/null`, `--no-ui-enabled`). Rejected: the default run
  garbles results on screen, and the user has no way to see that it did.
- **Plain progress lines when stdout is a pipe.** One line per stage, no cursor movement. Rejected:
  the lines still interleave with the reader's output on the same terminal, and a long run prints a
  line per update.
- **Gate spinners on `--verbose`, as #739 left them.** Rejected: progress on a slow request isn't
  diagnostics, and silence reads as a hang.
