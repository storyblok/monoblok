import type { Argument, Command, Option } from "commander";
import { getCommandAncestry } from "../config/helpers";
import { REDACTED } from "./config";

export type InvocationValue = string | number | boolean | readonly string[];

export type Invocation = {
  /** Space-separated command path, e.g. `storyblok components push`. */
  command: string;
  /** Options set on the command line, by long name (short name if there is none). */
  flags: Record<string, InvocationValue>;
  args: Record<string, InvocationValue>;
};

/**
 * Only values that can't carry user data are sent: booleans, numbers, and the option's own
 * choices. Anything else, such as a slug, search text, or path, only shows that it was set.
 */
function toReported(target: Option | Argument, value: unknown): InvocationValue | undefined {
  if (value === undefined || typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  if (target.argChoices && (typeof value === "string" || Array.isArray(value))) {
    return Array.isArray(value) ? value.map(String) : value;
  }
  return REDACTED;
}

function getCommandPath(command: Command): string {
  return getCommandAncestry(command)
    .map((current) => current.name())
    .join(" ");
}

/** Only flags typed on the command line, not config files, env, or defaults. */
function getFlags(command: Command): Invocation["flags"] {
  const flags: Invocation["flags"] = {};
  for (const current of getCommandAncestry(command).reverse()) {
    for (const option of current.options) {
      const key = option.attributeName();
      if (current.getOptionValueSource(key) !== "cli") {
        continue;
      }
      const flag = option.long ?? option.short ?? key;
      const name = flag.replace(option.negate ? /^--no-/ : /^-+/, "");
      const value = toReported(option, current.getOptionValue(key));
      // `--x` and `--no-x` share one value, so the first one wins.
      if (value !== undefined) {
        flags[name] ??= value;
      }
    }
  }
  return flags;
}

function getArgs(command: Command): Invocation["args"] {
  const args: Invocation["args"] = {};
  command.registeredArguments.forEach((argument, index) => {
    const value = toReported(argument, command.processedArgs[index]);
    if (value !== undefined) {
      args[argument.name()] = value;
    }
  });
  return args;
}

/**
 * Reads what Commander parsed. A rejected run (unknown flag, missing argument) has no processed
 * arguments, so `argsProcessed` must only be set once the action is about to run.
 */
export function describeInvocation(command: Command, argsProcessed: boolean): Invocation {
  return {
    command: getCommandPath(command),
    flags: getFlags(command),
    args: argsProcessed ? getArgs(command) : {},
  };
}
