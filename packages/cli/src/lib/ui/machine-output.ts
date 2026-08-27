import { getUI, onStdoutClosed, type UI } from "./ui";

/**
 * One JSON document per line on stdout, for commands whose result is data
 * rather than a report.
 *
 * Lives here rather than next to a command because every piece of it is about
 * the pipe, not about what is being piped: when the data goes out, and when the
 * reader on the other end has gone away. A second command that streams results
 * should reuse this rather than grow its own copy.
 */
export interface MachineOutput {
  /** Serializes `value` and writes it as one line, immediately. */
  push: (value: unknown) => void;
  /** Marks the end of the output and releases the pipe watcher. */
  close: () => void;
  /**
   * Aborts as soon as the downstream reader closes the pipe, so a producer can
   * pass it to `stream.pipeline()` and stop mid-run instead of fetching a whole
   * scope nobody is reading.
   */
  readonly signal: AbortSignal;
  /** Whether the downstream reader has already gone away. */
  readonly closed: boolean;
}

/**
 * Creates a JSONL writer over stdout.
 *
 * Lines go out as they are produced, always. Holding them back to keep progress
 * bars tidy would trade the only thing line-oriented output is *for* — a reader
 * that can act on the first line without waiting for the last — against a
 * cosmetic outcome this process cannot even reliably detect: whether the command
 * downstream prints to the same terminal is a property of that command, not of
 * anything visible from here. Streaming is also what lets `signal` fire early
 * enough to save work, and what keeps memory flat on a result set of any size.
 *
 * What *is* detectable is stdout being a terminal, which means the data itself
 * is landing on the same screen as the progress bars. That collision is certain
 * rather than guessed, so the bars are dropped for the run; the summary and
 * warnings on stderr stay. `2>/dev/null` or `--no-ui-enabled` silences the rest.
 */
export function createJsonlOutput({
  write,
  ui = getUI(),
}: {
  write?: (line: string) => void;
  ui?: UI;
} = {}): MachineOutput {
  const emit = write ?? ((line: string) => ui.writeMachineOutput(line));

  if (process.stdout.isTTY === true) {
    ui.suppressProgress();
  }

  const controller = new AbortController();
  const stopWatching = onStdoutClosed(() => {
    controller.abort(new DownstreamClosedError());
  });

  return {
    push(value) {
      if (controller.signal.aborted) {
        return;
      }
      emit(JSON.stringify(value));
    },
    close() {
      stopWatching();
    },
    get signal() {
      return controller.signal;
    },
    get closed() {
      return controller.signal.aborted;
    },
  };
}

/**
 * Raised as the abort reason when the reader on the other end of stdout exits
 * first (`… | head -5`).
 *
 * A distinct type so the command can tell "nobody is listening any more, stop
 * and exit 0" apart from a genuine pipeline failure. Losing that distinction
 * would report a successful early exit as a failed run.
 */
export class DownstreamClosedError extends Error {
  constructor() {
    super("The command downstream of this one closed its end of the pipe.");
    this.name = "DownstreamClosedError";
  }
}

export function isDownstreamClosed(error: unknown): boolean {
  // `stream.pipeline()` does not reject with the reason it was aborted for: it
  // raises its own `AbortError` and moves that reason onto `cause`. Matching the
  // cause rather than the wrapper keeps this working whichever of the two
  // arrives, and stops an unrelated abort from being read as a closed pipe.
  return (
    error instanceof DownstreamClosedError ||
    (error instanceof Error && error.cause instanceof DownstreamClosedError)
  );
}
