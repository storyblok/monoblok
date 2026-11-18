import { stripVTControlCharacters } from "node:util";
import {
  confirm as inquirerConfirm,
  input as inquirerInput,
  password as inquirerPassword,
  select as inquirerSelect,
} from "@inquirer/prompts";

import { CommandError } from "../../utils/error/command-error";

type NonInteractive = {
  /**
   * Names the flag or argument that answers the prompt, for runs without a
   * terminal, e.g. "Pass --yes to apply the rollback without confirming."
   */
  nonInteractiveHint: string;
};

/** Prompts render on stderr so stdout stays clean for the command's output. */
const promptContext = { output: process.stderr } as const;

/**
 * Without a terminal on stdin, an `@inquirer/prompts` prompt never settles:
 * Node drops the pending top-level await and exits 0 without doing anything,
 * which a CI job reads as success.
 */
function assertTerminal(message: string, nonInteractiveHint: string): void {
  if (process.stdin.isTTY) {
    return;
  }
  const question = stripVTControlCharacters(message)
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .trim();
  throw new CommandError(
    `Cannot ask "${question}" because stdin is not a terminal. ${nonInteractiveHint}`,
  );
}

export async function confirm({
  nonInteractiveHint,
  ...config
}: Parameters<typeof inquirerConfirm>[0] & NonInteractive): Promise<boolean> {
  assertTerminal(config.message, nonInteractiveHint);
  return inquirerConfirm(config, promptContext);
}

export async function select<Value>({
  nonInteractiveHint,
  ...config
}: Parameters<typeof inquirerSelect<Value>>[0] & NonInteractive): Promise<Value> {
  assertTerminal(config.message, nonInteractiveHint);
  return inquirerSelect(config, promptContext);
}

export async function input({
  nonInteractiveHint,
  ...config
}: Parameters<typeof inquirerInput>[0] & NonInteractive): Promise<string> {
  assertTerminal(config.message, nonInteractiveHint);
  return inquirerInput(config, promptContext);
}

export async function password({
  nonInteractiveHint,
  ...config
}: Parameters<typeof inquirerPassword>[0] & NonInteractive): Promise<string> {
  assertTerminal(config.message, nonInteractiveHint);
  return inquirerPassword(config, promptContext);
}
