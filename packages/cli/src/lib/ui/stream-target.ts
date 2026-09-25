import { fstatSync } from "node:fs";

/**
 * What a standard stream's file descriptor is actually connected to.
 *
 * `isTTY` alone collapses `> out.json`, `| jq .` and `> /dev/null` into a single
 * "not a terminal" bucket. They differ in ways a caller can act on: a file has
 * no reader waiting on it and can be written in large batches, while a pipe may
 * have a consumer acting on every line.
 */
export type StreamTarget = "terminal" | "file" | "pipe" | "device" | "unknown";

const STDOUT_FD = 1;
const STDERR_FD = 2;

function classify(fd: number, isTTY: boolean | undefined): StreamTarget {
  // Node only sets `isTTY` when the descriptor is a terminal, so this is both
  // the fast path and the authoritative one; `fstat` cannot distinguish a
  // terminal from any other character device on its own.
  if (isTTY === true) {
    return "terminal";
  }

  try {
    const stat = fstatSync(fd);
    if (stat.isFile()) {
      return "file";
    }
    if (stat.isFIFO() || stat.isSocket()) {
      return "pipe";
    }
    if (stat.isCharacterDevice()) {
      // `> /dev/null` in practice: a character device that is not a terminal.
      return "device";
    }
  } catch {
    // EBADF: the descriptor was closed out from under us. Nothing to report,
    // and throwing here would take down a command over a diagnostic detail.
  }

  return "unknown";
}

/** Where `> out.json`, `| jq .` and an interactive run can be told apart. */
export function getStdoutTarget(): StreamTarget {
  return classify(STDOUT_FD, process.stdout.isTTY);
}

/** Whether stderr can host redrawing UI. See `UI`'s `canRedraw`. */
export function getStderrTarget(): StreamTarget {
  return classify(STDERR_FD, process.stderr.isTTY);
}
