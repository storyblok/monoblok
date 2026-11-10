import type { Argument, Command, Option } from "commander";
import { MAX_VALUE_LENGTH, REDACTED, TOO_LONG } from "./config";
import { isTelemetryValueAllowed } from "./denylist";

export type InvocationValue = string | string[] | boolean;

export type Invocation = {
  /** Space-separated command path, e.g. `storyblok components push`. */
  command: string;
  /** Options set on the command line, by long name (short name if there is none). */
  flags: Record<string, InvocationValue>;
  args: Record<string, InvocationValue>;
};

function toReported(target: Option | Argument, name: string, value: unknown) {
  if (value === undefined || typeof value === "boolean") {
    return value;
  }
  if (!isTelemetryValueAllowed(target, name)) {
    return REDACTED;
  }
  const truncate = (item: unknown) => {
    const text = String(item);
    return text.length > MAX_VALUE_LENGTH ? TOO_LONG : text;
  };
  return Array.isArray(value) ? value.map(truncate) : truncate(value);
}

function getCommandPath(command: Command): string {
  const names: string[] = [];
  for (let current: Command | null = command; current; current = current.parent) {
    names.unshift(current.name());
  }
  return names.join(" ");
}

/** Values from config files, env, and defaults are left out: only what was typed counts. */
function getFlags(command: Command): Invocation["flags"] {
  const flags: Invocation["flags"] = {};
  for (let current: Command | null = command; current; current = current.parent) {
    for (const option of current.options) {
      const key = option.attributeName();
      if (current.getOptionValueSource(key) !== "cli") {
        continue;
      }
      const flag = option.long ?? option.short ?? key;
      const name = flag.replace(option.negate ? /^--no-/ : /^-+/, "");
      const value = toReported(option, name, current.getOptionValue(key));
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
    const value = toReported(argument, argument.name(), command.processedArgs[index]);
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
