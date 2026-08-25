import type { Attributes } from "@opentelemetry/api";
import type { CommanderCommand, CommanderOption } from "../config/types";
import { ATTRIBUTE_PREFIX } from "./constants";

// Attribute keys taken from the OpenTelemetry semantic conventions are spelled out as
// literals so this module stays free of runtime imports: it is loaded on every CLI run,
// while the OpenTelemetry packages are only loaded when telemetry is actually enabled.
const ATTR_SERVICE_NAME = "service.name";
const ATTR_SERVICE_VERSION = "service.version";
const ATTR_ERROR_TYPE = "error.type";
const ATTR_HTTP_RESPONSE_STATUS_CODE = "http.response.status_code";

export interface RuntimeInfo {
  serviceName: string;
  cliVersion: string;
  nodeVersion: string;
  platform: string;
  arch: string;
  ci: boolean;
}

export interface CommandInfo {
  /** Space-separated command path, program name included: "storyblok components pull". */
  command: string;
  /** Long flag names the user passed, values excluded. */
  flags: string[];
  region?: string;
  /** Ties the span to the run's log and report files. */
  runId?: number;
}

/**
 * Identity of the process the spans belong to. Everything here is about the machine and
 * the release, never about the user or their content.
 */
export function buildResourceAttributes(info: RuntimeInfo): Attributes {
  return {
    [ATTR_SERVICE_NAME]: info.serviceName,
    [ATTR_SERVICE_VERSION]: info.cliVersion,
    "process.runtime.name": "nodejs",
    "process.runtime.version": info.nodeVersion,
    "os.type": info.platform,
    "os.arch": info.arch,
    [`${ATTRIBUTE_PREFIX}.ci`]: info.ci,
  };
}

/**
 * What the run was asked to do. Deliberately limited to values that cannot identify a
 * user, a space, or their content: the command path, the names of the flags that were
 * passed, and the region the API calls target.
 */
export function buildCommandAttributes(info: CommandInfo): Attributes {
  const attributes: Attributes = {
    [`${ATTRIBUTE_PREFIX}.command`]: info.command,
    [`${ATTRIBUTE_PREFIX}.flags`]: info.flags,
  };
  if (info.region) {
    attributes[`${ATTRIBUTE_PREFIX}.region`] = info.region;
  }
  if (info.runId !== undefined) {
    attributes[`${ATTRIBUTE_PREFIX}.run_id`] = String(info.runId);
  }
  return attributes;
}

/**
 * Classify a failure without carrying its message: error messages interpolate space
 * names, file paths, and API payloads, none of which belong in telemetry. Errors are
 * read structurally so this module stays independent of the error classes.
 */
export function buildErrorAttributes(error: unknown): Attributes {
  const attributes: Attributes = { [ATTR_ERROR_TYPE]: getErrorType(error) };
  if (typeof error !== "object" || error === null) {
    return attributes;
  }

  const { errorId, code } = error as { errorId?: unknown; code?: unknown };
  if (typeof errorId === "string" && errorId) {
    attributes[`${ATTRIBUTE_PREFIX}.error.id`] = errorId;
  }
  // APIError carries the HTTP status in `code` (0 when the request never got a response),
  // while filesystem and network errors carry a symbolic code such as "ENOENT".
  if (typeof code === "number" && code > 0) {
    attributes[ATTR_HTTP_RESPONSE_STATUS_CODE] = code;
  } else if (typeof code === "string" && code) {
    attributes[`${ATTRIBUTE_PREFIX}.error.code`] = code;
  }
  return attributes;
}

function getErrorType(error: unknown): string {
  if (error instanceof Error && error.name) {
    return error.name;
  }
  if (typeof error === "object" && error !== null) {
    return error.constructor?.name || "Error";
  }
  return typeof error;
}

/**
 * The long flag names explicitly typed on the command line — never their values.
 * Commander tags every option it filled from argv with the "cli" source, which is what
 * separates a user's choice from a default or a config file value.
 *
 * Negatable booleans are declared as a pair of options (`--ui-enabled` and
 * `--no-ui-enabled`) sharing one attribute, so the source alone cannot tell which half was
 * typed and reporting both would be wrong. The resolved value decides: `false` means the
 * negated form was used.
 */
export function collectExplicitFlags(commandChain: CommanderCommand[]): string[] {
  const flags = new Set<string>();
  for (const command of commandChain) {
    const explicitOptions = new Map<string, CommanderOption[]>();
    for (const option of command.options) {
      const attributeName = option.attributeName();
      if (command.getOptionValueSource(attributeName) !== "cli") {
        continue;
      }
      const group = explicitOptions.get(attributeName) ?? [];
      group.push(option);
      explicitOptions.set(attributeName, group);
    }

    for (const [attributeName, options] of explicitOptions) {
      const negated = command.getOptionValue(attributeName) === false;
      const option = options.find((candidate) => candidate.negate === negated) ?? options[0];
      const name = option.long || option.short;
      if (name) {
        flags.add(name);
      }
    }
  }
  return [...flags].sort();
}
