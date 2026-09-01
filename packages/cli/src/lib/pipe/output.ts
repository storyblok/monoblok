import { Writable } from "node:stream";
import { getUI, onStdoutClosed, type UI } from "../ui";

/**
 * One JSON document per line on stdout, for commands whose result is data
 * rather than a report.
 *
 * Every piece of it is about the pipe, not about what is being piped: when the
 * data goes out, how fast the reader can take it, and when the reader on the
 * other end has gone away. A second command that streams results reuses this
 * rather than growing its own copy.
 */
export interface MachineOutput {
  /**
   * Serializes `value` and writes it as one line, immediately.
   *
   * For a producer that is not a stream. It cannot apply backpressure — the call
   * is synchronous, so a slow reader is absorbed by stdout's buffer rather than
   * felt by the caller. A stream producer must use {@link MachineOutput.sink}
   * instead, which does.
   */
  push: (value: unknown) => void;
  /**
   * The same output as a `Writable`, for use as the terminal stage of a
   * `stream.pipeline()`.
   *
   * This is the form to prefer: holding the stream callback back until stdout
   * drains is what pushes a slow reader's pace all the way up the pipeline, so a
   * run costs the memory of what is in flight rather than of the whole result
   * set.
   */
  readonly sink: Writable;
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
 * Writes one line at a time and says whether the destination wants more.
 *
 * Split out from the writer itself so the backpressure path is reachable in a
 * test without a real pipe on the other end of stdout.
 */
export interface LineWriter {
  /** Writes one line. `false` means the destination's buffer is full. */
  write: (line: string) => boolean;
  /** Resolves when the destination can take more, or when the reader has left. */
  waitForDrain: (signal: AbortSignal) => Promise<void>;
}

const stdoutLineWriter = (ui: UI): LineWriter => ({
  write: (line) => ui.writeMachineOutput(line),
  waitForDrain: (signal) =>
    new Promise<void>((resolve) => {
      if (signal.aborted) {
        resolve();
        return;
      }
      // Racing the abort matters: once the reader is gone, stdout never drains,
      // and waiting on `'drain'` alone would hang the run instead of ending it.
      const done = (): void => {
        process.stdout.off("drain", done);
        signal.removeEventListener("abort", done);
        resolve();
      };
      process.stdout.once("drain", done);
      signal.addEventListener("abort", done, { once: true });
    }),
});

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
  writer,
  ui = getUI(),
}: {
  /** Convenience form for a caller that cannot be backpressured anyway. */
  write?: (line: string) => void;
  /** Full form, including the backpressure signal. Takes precedence. */
  writer?: LineWriter;
  ui?: UI;
} = {}): MachineOutput {
  const lineWriter: LineWriter =
    writer ??
    (write
      ? {
          write: (line) => {
            write(line);
            return true;
          },
          waitForDrain: async () => {},
        }
      : stdoutLineWriter(ui));

  if (process.stdout.isTTY === true) {
    ui.suppressProgress();
  }

  const controller = new AbortController();
  const stopWatching = onStdoutClosed(() => {
    controller.abort(new DownstreamClosedError());
  });

  const sink = new Writable({
    objectMode: true,
    write(value: unknown, _encoding, callback) {
      if (controller.signal.aborted) {
        // Not a failure of this stage: the pipeline above is being torn down for
        // the same reason, and it owns how the run ends.
        callback();
        return;
      }

      let line: string;
      try {
        line = JSON.stringify(value);
      } catch (maybeError) {
        callback(maybeError as Error);
        return;
      }

      if (lineWriter.write(line)) {
        callback();
        return;
      }
      // stdout's buffer is full, so the reader is slower than this run is. Not
      // calling back yet is what makes the whole pipeline wait for it.
      lineWriter.waitForDrain(controller.signal).then(() => callback(), callback);
    },
  });

  return {
    push(value) {
      if (controller.signal.aborted) {
        return;
      }
      lineWriter.write(JSON.stringify(value));
    },
    get sink() {
      return sink;
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
 * The in-process counterpart of {@link MachineOutput.sink}: a terminal stage for
 * a producer whose results are consumed here rather than written out.
 *
 * `--check-references` is the case it exists for — it has to hold every match
 * until the whole scope has been listed — and it keeps such a run on the same
 * shape as a streaming one, so the pipeline always ends in a sink.
 */
export function createCollectingSink<T>(consume: (value: T) => void): Writable {
  return new Writable({
    objectMode: true,
    write(value: T, _encoding, callback) {
      try {
        consume(value);
        callback();
      } catch (maybeError) {
        callback(maybeError as Error);
      }
    },
  });
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
  // raises its own `AbortError` and moves that reason onto `cause`. Walking the
  // chain rather than checking a single level keeps this working however many
  // wrappers sit in between — one pipeline nested in another already makes two —
  // while still not mistaking an unrelated abort for a closed pipe.
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current instanceof Error && !seen.has(current)) {
    if (current instanceof DownstreamClosedError) {
      return true;
    }
    seen.add(current);
    current = current.cause;
  }
  return false;
}
