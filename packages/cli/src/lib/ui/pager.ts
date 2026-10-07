import { spawn } from "node:child_process";

const PAGER = "less";
/**
 * The flags `git` and `gh` give `less`: quit if the text fits one screen (F),
 * pass colors through (R), and leave the text on screen after quitting (X).
 *
 * Passed as arguments rather than as `LESS` when it is unset, the way `git`
 * does it, because a common shell setup exports `LESS=-R`, which would drop
 * `-F` and hold even a three-row table in the pager. `less` reads `LESS` first
 * and the arguments after, so a reader's own options, `-S` included, still apply.
 */
const PAGER_ARGS = ["-FRX"];

// Not awaited: a write to a terminal is synchronous, and that is the only place
// this is printed to outside of tests.
const writeStdout = (text: string): void => {
  process.stdout.write(`${text}\n`);
};

/**
 * Prints text to stdout, through a pager when stdout is a terminal.
 *
 * A pager rather than an interactive list: it gives scrolling and search for
 * free, behaves the way `git log` and `gh` already taught everyone, and leaves
 * nothing to maintain here. The pager decides whether the text fits the screen
 * (`-F`), because only it knows how many lines a long row wraps onto.
 *
 * Printed directly instead where no pager can run: a missing `less`, as on most
 * Windows machines, and a `dumb` terminal (Emacs `M-x shell`), where `less`
 * stops at a warning and quitting it never shows the text.
 */
export async function page(text: string): Promise<void> {
  if (process.stdout.isTTY !== true || process.env.TERM === "dumb") {
    writeStdout(text);
    return;
  }

  await new Promise<void>((resolve) => {
    // Ctrl+C belongs to the pager while it runs: `less` handles it itself, and
    // the default handler would exit the CLI out from under it and leave the
    // terminal in whatever mode `less` had put it in.
    const ignoreInterrupt = (): void => {};
    process.on("SIGINT", ignoreInterrupt);

    const child = spawn(PAGER, PAGER_ARGS, { stdio: ["pipe", "inherit", "inherit"] });
    let failedToStart = false;
    child.on("error", () => {
      failedToStart = true;
    });
    // Fires after `'error'` too, so a pager that never started ends up here.
    child.on("close", () => {
      process.off("SIGINT", ignoreInterrupt);
      // Nothing has been shown yet, so the text still has to go out.
      if (failedToStart) {
        writeStdout(text);
      }
      resolve();
    });
    // Quitting the pager before reading everything closes its stdin under us.
    child.stdin.on("error", () => {});
    child.stdin.end(`${text}\n`);
  });
}
