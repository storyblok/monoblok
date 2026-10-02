import { spawn } from "node:child_process";

/**
 * `less` with the flags `git` and `gh` use: quit if the text fits one screen
 * (F), pass colors through (R), and leave the text on screen after quitting (X).
 */
const PAGER = "less";
const PAGER_ARGS = ["-FRX"];

// Not awaited: a write to a terminal is synchronous, and that is the only place
// this is printed to outside of tests.
const writeStdout = (text: string): void => {
  process.stdout.write(`${text}\n`);
};

/**
 * Prints text to stdout, through a pager when it is taller than the terminal.
 *
 * A pager rather than an interactive list: it gives scrolling and search for
 * free, behaves the way `git log` and `gh` already taught everyone, and leaves
 * nothing to maintain here. A missing pager, as on most Windows machines, falls
 * back to printing the text.
 */
export async function page(text: string): Promise<void> {
  const lines = text.split("\n").length;
  if (process.stdout.isTTY !== true || lines < (process.stdout.rows ?? Infinity)) {
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
