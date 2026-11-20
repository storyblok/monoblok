import { confirm } from "@inquirer/prompts";
import { getStderrTarget, getStdinTarget } from "../ui/stream-target";
import { promptOnStderr } from "../ui";
import { usageError } from "./errors";

type ConfirmOptions = { yes: boolean; dryRun: boolean; readsStdin: boolean };

/**
 * Fails with exit 2, before any request, when a destructive write would need
 * a prompt nobody can answer: the prompt reads stdin and renders on stderr, so
 * both must be terminals, and with `-` stdin carries the data. `--yes`
 * answers for the caller; dry runs write nothing and never ask.
 */
export function assertCanConfirm({ yes, dryRun, readsStdin }: ConfirmOptions): void {
  if (yes || dryRun) {
    return;
  }
  if (readsStdin) {
    throw usageError(
      "Pass --yes to confirm: stdin carries the data, so it cannot answer a prompt.",
    );
  }
  if (getStdinTarget() !== "terminal" || getStderrTarget() !== "terminal") {
    throw usageError("Pass --yes to confirm: there is no terminal to ask on.");
  }
}

/** Whether a destructive write may go ahead: asks unless `--yes` or a dry run answers. */
export async function confirmWrite(
  message: () => string,
  options: ConfirmOptions,
): Promise<boolean> {
  assertCanConfirm(options);
  if (options.yes || options.dryRun) {
    return true;
  }
  return promptOnStderr((context) => confirm({ message: message(), default: false }, context));
}
