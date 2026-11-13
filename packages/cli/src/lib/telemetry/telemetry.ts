import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import { confirm } from "@inquirer/prompts";
import chalk from "chalk";
import { join } from "pathe";
import { colorPalette, commands } from "../../constants";
import { isPromptCancellation } from "../../utils/error/inspect";
import { getPackageJson } from "../../utils/package";
import { getCommandAncestry } from "../config/helpers";
import { getUI, isPagerOpen, stderrPromptContext } from "../ui";
import {
  PRIVACY_POLICY_URL,
  REDACTED,
  SERVICE_NAME,
  TELEMETRY_DOCS_URL,
  TELEMETRY_ENDPOINT,
  TELEMETRY_ENV,
  TELEMETRY_PAYLOAD_FILE_PREFIX,
} from "./config";
import { getConsentFilePath, getTelemetryStatus, saveConsent } from "./consent";
import {
  getAgent,
  getHostArch,
  getOsType,
  getPackageManager,
  isCi,
  isContainer,
  isInteractive,
  isTruthyEnv,
} from "./environment";
import { getErrorType, UNRECORDED_ERROR } from "./error-type";
import { describeInvocation } from "./invocation";
import type { Attributes } from "./otlp";
import { buildMetricsPayload, buildTracesPayload, createTraceContext } from "./otlp";
import {
  claimTelemetrySend,
  getRunState,
  recordTelemetryError,
  recordTelemetryInterrupt,
  recordTelemetryPromptDuration,
  recordTelemetryStatus,
  recordTelemetryTraceContext,
} from "./run";
import type { TelemetryPayloads } from "./transport";

/** Emitted next to the CLI's entry, from `src/entrypoints/telemetry-sender.ts`. */
const SENDER_FILE = "telemetry-sender.mjs";

const SPAN_NAME = "storyblok.cli.command";
const COMMAND_COUNTER = "storyblok.cli.command.count";
const ERROR_COUNTER = "storyblok.cli.error.count";

/** `findings`: a non-zero exit that reports a result, e.g. `schema diff --exit-code` found differences. */
type Outcome = "success" | "findings" | "error" | "canceled";

const EXIT_CODE_INTERRUPTED = 130;

export function isTelemetryDebugEnabled(): boolean {
  return isTruthyEnv(process.env[TELEMETRY_ENV.DEBUG]);
}

export function isTelemetryCommand(command: Command): boolean {
  return getCommandAncestry(command).some(
    (current) => current.parent && current.name() === commands.TELEMETRY,
  );
}

/** Without a TTY or in CI nobody can answer, and a container would ask on every run. */
export function canPromptForTelemetryConsent(): boolean {
  return isInteractive() && !isCi() && !isContainer() && getAgent() === undefined;
}

/**
 * Asks once, on the first interactive run. Where it can't ask, telemetry stays off until
 * `storyblok telemetry enable`.
 */
export async function promptForTelemetryConsent(): Promise<void> {
  if (!canPromptForTelemetryConsent() || isTelemetryDebugEnabled()) {
    return;
  }
  const status = getTelemetryStatus();
  if (status.enabled || status.reason !== "undecided") {
    return;
  }

  const disableCommand = chalk.hex(colorPalette.PRIMARY)(`storyblok ${commands.TELEMETRY} disable`);
  const promptStartedAt = performance.now();
  try {
    const enabled = await confirm(
      {
        message: [
          "The Storyblok CLI can share usage data with Storyblok to prioritize fixes and features.",
          `  What is shared: ${TELEMETRY_DOCS_URL}`,
          `  Privacy policy: ${PRIVACY_POLICY_URL}`,
          `  Opt out at any time with ${disableCommand}.`,
          "  Share usage data?",
        ].join("\n"),
        default: false,
      },
      stderrPromptContext,
    );
    await saveConsent(enabled);
  } catch (error) {
    if (isPromptCancellation(error)) {
      // The prompt swallowed the signal, so it is raised again: Ctrl+C here cancels the command,
      // and shells and scripts must see that. Rethrown for platforms where the signal doesn't kill.
      process.kill(process.pid, "SIGINT");
      throw error;
    }
    getUI().warn(
      `Couldn't save your answer to ${getConsentFilePath()}. The CLI asks again on the next run.`,
    );
  } finally {
    recordTelemetryPromptDuration(performance.now() - promptStartedAt);
  }
}

/**
 * Without a listener, Ctrl+C kills the process before the run is recorded. The listener sends the
 * run and re-raises the signal, so shells and scripts still see the process die from it.
 */
function listenForInterrupt(program: Command): void {
  const onInterrupt = () => {
    if (isPagerOpen()) {
      return;
    }
    // Removed so the re-raised signal ends the process.
    process.off("SIGINT", onInterrupt);
    recordTelemetryInterrupt();
    sendTelemetry({ program, exitCode: EXIT_CODE_INTERRUPTED });
    process.kill(process.pid, "SIGINT");
  };
  process.on("SIGINT", onInterrupt);
}

/** Call after the consent prompt and before the first request to the Management API. */
export function startTelemetryRun(program: Command): void {
  try {
    const status = getTelemetryStatus();
    const debug = isTelemetryDebugEnabled();
    recordTelemetryStatus(status);
    // Debug mode sends nothing, so it doesn't link API requests either.
    if (status.enabled && !debug) {
      recordTelemetryTraceContext(createTraceContext());
    }
    // In debug mode too, so it shows what an interrupted run would send.
    if (status.enabled || debug) {
      listenForInterrupt(program);
    }
  } catch {
    // Without a readable consent, the run isn't recorded.
  }
}

/**
 * Sends from the `exit` event, so a run that ends in an uncaught error or a `process.exit()` is
 * recorded with its real exit code. A process killed by a signal other than Ctrl+C isn't recorded.
 */
export function sendTelemetryOnExit(program: Command): void {
  process.once("uncaughtExceptionMonitor", recordTelemetryError);
  process.once("exit", (exitCode) => sendTelemetry({ program, exitCode }));
}

function getOutcome(exitCode: number): { outcome: Outcome; errorType?: string } {
  const { canceled, error, hasFindings } = getRunState();
  if (canceled) {
    return { outcome: "canceled" };
  }
  // Some commands log a failed item and still succeed, e.g. by fetching it another way.
  if (exitCode === 0) {
    return { outcome: "success" };
  }
  if (error !== undefined) {
    return { outcome: "error", errorType: getErrorType(error) };
  }
  return hasFindings ? { outcome: "findings" } : { outcome: "error", errorType: UNRECORDED_ERROR };
}

function prefixKeys(prefix: string, values: Attributes): Attributes {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [prefix + key, value]));
}

export type TelemetryRun = {
  program: Command;
  exitCode: number;
  /** Epoch milliseconds. Defaults to the process start, so startup counts. */
  startTime?: number;
  endTime?: number;
};

export function buildTelemetryPayloads(
  input: TelemetryRun,
  installId: string | undefined,
): TelemetryPayloads {
  const run = getRunState();
  const { version } = getPackageJson();
  // Time spent answering the consent prompt isn't time the command took.
  const startTime = (input.startTime ?? performance.timeOrigin) + (run.promptDurationMs ?? 0);
  const endTime = input.endTime ?? Date.now();
  const invocation = describeInvocation(run.command ?? input.program, run.argsProcessed === true);
  const { outcome, errorType } = getOutcome(input.exitCode);

  const resource: Attributes = {
    "service.name": SERVICE_NAME,
    "service.version": version,
    "os.type": getOsType(),
    "host.arch": getHostArch(),
    "process.runtime.name": "nodejs",
    "process.runtime.version": process.versions.node,
  };
  const scope = { name: SERVICE_NAME, version };
  const commandAttributes: Attributes = {
    "storyblok.cli.command": invocation.command,
    "storyblok.cli.outcome": outcome,
    "storyblok.cli.ci": isCi(),
    "storyblok.cli.agent": getAgent(),
    "storyblok.cli.region": run.region,
  };

  const traces = buildTracesPayload(resource, scope, {
    name: SPAN_NAME,
    context: run.traceContext ?? createTraceContext(),
    startTime,
    endTime,
    isError: outcome === "error",
    attributes: {
      ...commandAttributes,
      "error.type": errorType,
      "process.exit.code": input.exitCode,
      "storyblok.cli.install.id": installId,
      "storyblok.cli.space.id": run.spaceId,
      "storyblok.cli.package_manager": getPackageManager(),
      ...prefixKeys("storyblok.cli.flag.", invocation.flags),
      ...prefixKeys("storyblok.cli.arg.", invocation.args),
    },
  });

  const counters = [
    {
      name: COMMAND_COUNTER,
      description: "CLI command invocations",
      unit: "{invocation}",
      attributes: commandAttributes,
    },
  ];
  if (errorType) {
    counters.push({
      name: ERROR_COUNTER,
      description: "CLI command invocations that ended with an error",
      unit: "{error}",
      attributes: { ...commandAttributes, "error.type": errorType },
    });
  }
  const metrics = buildMetricsPayload(resource, scope, counters, { startTime, endTime });

  return { traces, metrics };
}

function writeDebugOutput(path: string, payload: unknown): void {
  process.stderr.write(
    `[telemetry] POST ${TELEMETRY_ENDPOINT}${path} (debug mode, not sent)\n${JSON.stringify(payload, null, 2)}\n`,
  );
}

/**
 * Dash0 takes about a second to answer and drops a request whose client hangs up early, so a
 * detached process waits for it and the run exits right away. The payload goes through a file
 * because only synchronous work completes while the process exits.
 */
function sendDetached(payloads: TelemetryPayloads): void {
  const payloadFile = join(tmpdir(), `${TELEMETRY_PAYLOAD_FILE_PREFIX}${randomUUID()}.json`);
  const removePayloadFile = () => rmSync(payloadFile, { force: true });
  writeFileSync(payloadFile, JSON.stringify(payloads), { mode: 0o600, flag: "wx" });
  try {
    const child = spawn(
      process.execPath,
      [fileURLToPath(new URL(SENDER_FILE, import.meta.url)), payloadFile],
      { detached: true, stdio: "ignore", windowsHide: true },
    );
    child.on("error", removePayloadFile);
    child.unref();
  } catch {
    removePayloadFile();
  }
}

/** Never throws or waits for the endpoint, so telemetry can't break or stall a command. */
export function sendTelemetry(input: TelemetryRun): void {
  try {
    if (!claimTelemetrySend()) {
      return;
    }
    const debug = isTelemetryDebugEnabled();
    // The `telemetry` commands and rejected runs never start a run.
    const status = getRunState().status ?? getTelemetryStatus();
    if (!status.enabled && !debug) {
      return;
    }

    const payloads = buildTelemetryPayloads(input, status.enabled ? status.installId : REDACTED);
    if (debug) {
      writeDebugOutput("/v1/traces", payloads.traces);
      writeDebugOutput("/v1/metrics", payloads.metrics);
      return;
    }
    sendDetached(payloads);
  } catch {
    // Telemetry must never fail a command.
  }
}
