import { fstatSync } from "node:fs";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { CommandError } from "../../utils/error/command-error";
import { toError } from "../../utils/error/error";

/**
 * The argument that means "read the input from stdin".
 *
 * Explicit rather than detected, for two reasons. The usual probe cannot tell
 * piped input from no input — `process.stdin.isTTY` is `null` for a pipe, for
 * `< /dev/null`, for a file redirect and for a closed descriptor alike — so under
 * CI, cron or `docker` without `-i`, a command that guessed would silently
 * operate on zero records and exit 0. And a command that consumes stdin
 * unasked breaks as the child of a loop sharing that descriptor: in
 * `cat list.txt | while read x; do cmd; done` it would eat the rest of
 * `list.txt` and the loop would run once. This is why `ssh` has `-n`.
 *
 * `-` is the established convention: `git apply -`, `kubectl apply -f -`,
 * `docker build -`, `tar -f -`.
 */
export const STDIN_ARGUMENT = "-";

export const isStdinArgument = (value: string | undefined): boolean => value === STDIN_ARGUMENT;

/**
 * What is actually attached to stdin.
 *
 * Only ever used for a nudge — "you piped something in but did not pass `-`, and
 * this run is about to go space-wide" — never to decide the input source, which
 * stays {@link STDIN_ARGUMENT}'s job.
 */
export type StdinKind = "pipe" | "file" | "terminal" | "empty";

export function probeStdin(fd: number = 0): StdinKind {
  try {
    const stats = fstatSync(fd);
    if (stats.isFIFO()) {
      return "pipe";
    }
    if (stats.isFile()) {
      return "file";
    }
    // A terminal, `/dev/null` and a closed descriptor are all character devices,
    // and only the first of them is a TTY.
    return process.stdin.isTTY === true ? "terminal" : "empty";
  } catch {
    return "empty";
  }
}

/** True when something was piped or redirected in, whether or not `-` was passed. */
export const hasPipedStdin = (fd: number = 0): boolean => {
  const kind = probeStdin(fd);
  return kind === "pipe" || kind === "file";
};

/**
 * Reads JSONL from a stream and yields one parsed document per line.
 *
 * The counterpart of {@link MachineOutput}: whatever a producer writes there,
 * this reads back. Being a `Readable` in object mode means a consumer mounts it
 * as the head of the same `stream.pipeline()` it would have put a list fetcher
 * at, and inherits the backpressure with it — the file or pipe is read at the
 * pace the stages below can take, never faster.
 *
 * Blank lines are skipped: a trailing newline is how a line-oriented file ends,
 * not a record.
 *
 * A malformed line fails the run by default. Silently skipping it would answer a
 * different question than the one asked — a truncated producer would look like a
 * clean short read — so a caller that would rather report and continue has to
 * say so by passing `onLineError`.
 */
export function createJsonlSource<T = unknown>({
  input = process.stdin,
  map,
  onLineRead,
  onLineError,
}: {
  input?: Readable;
  /**
   * Turns a parsed line into what the pipeline below expects, typically by
   * validating it against a contract.
   *
   * Applied here rather than in a stage of its own so a rejection can name the
   * line it came from: a `Readable` buffers ahead of its consumer, so by the time
   * a separate stage saw the document, the line number would already have moved
   * on.
   */
  map?: (value: unknown, lineNumber: number) => T;
  /** Called for every document that parsed, with its 1-based line number. */
  onLineRead?: (value: unknown, lineNumber: number) => void;
  /** Called instead of failing the run. The line is skipped afterwards. */
  onLineError?: (error: Error, lineNumber: number, raw: string) => void;
} = {}): Readable {
  async function* parse(): AsyncGenerator<T> {
    const lines = createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY });
    let lineNumber = 0;

    for await (const raw of lines) {
      lineNumber += 1;
      const trimmed = raw.trim();
      if (!trimmed) {
        continue;
      }

      let value: unknown;
      try {
        value = JSON.parse(trimmed);
      } catch (maybeError) {
        if (!onLineError) {
          throw new CommandError(
            `Invalid JSON on input line ${lineNumber}: ${toError(maybeError).message}\n` +
              "The input has to be JSONL — one complete JSON document per line, as `storyblok stories find` writes it.",
          );
        }
        onLineError(toError(maybeError), lineNumber, trimmed);
        continue;
      }

      onLineRead?.(value, lineNumber);
      yield map ? map(value, lineNumber) : (value as T);
    }
  }

  return Readable.from(parse());
}
