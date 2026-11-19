import { confirm } from "@inquirer/prompts";
import { getStderrTarget, getStdinTarget } from "../ui/stream-target";
import { stderrPromptContext } from "../ui";
import { usageError } from "./errors";

/**
 * Whether a destructive write may go ahead.
 *
 * `--yes` answers for the caller. Without it, a person has to be there to
 * answer: the prompt reads stdin and renders on stderr, so both must be
 * terminals, or the run stops with exit 2 instead of hanging on a prompt
 * nobody sees. With `-`, stdin carries the data, so `--yes` is required.
 * Dry runs write nothing and never ask.
 */
export async function confirmWrite({
  message,
  yes,
  dryRun,
  readsStdin,
}: {
  message: () => string;
  yes: boolean;
  dryRun: boolean;
  readsStdin: boolean;
}): Promise<boolean> {
  if (yes || dryRun) {
    return true;
  }
  if (readsStdin) {
    throw usageError(
      "Pass --yes to confirm: stdin carries the data, so it cannot answer a prompt.",
    );
  }
  if (getStdinTarget() !== "terminal" || getStderrTarget() !== "terminal") {
    throw usageError("Pass --yes to confirm: there is no terminal to ask on.");
  }
  return confirm({ message: message(), default: false }, stderrPromptContext);
}
