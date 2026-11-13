import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import { confirm } from "@inquirer/prompts";
import chalk from "chalk";
import { colorPalette, commands } from "../../constants";
import { getPackageJson } from "../../utils/package";
import { getCommandAncestry } from "../config/helpers";
import { getUI, isPagerOpen, stderrPromptContext } from "../ui";
import {
  PRIVACY_NOTICE_URL,
  REDACTED,
  SERVICE_NAME,
  TELEMETRY_AUTH_TOKEN,
  TELEMETRY_DATASET,
  TELEMETRY_DOCS_URL,
  TELEMETRY_ENDPOINT,
  TELEMETRY_ENV,
  TELEMETRY_SENDER_ENTRY,
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
import { CANCELED, getErrorType } from "./error-type";
import { describeInvocation } from "./invocation";
import type { Attributes } from "./otlp";
import { buildMetricsPayload, buildTracesPayload, createTraceContext } from "./otlp";
import {
  claimTelemetrySend,
  getRunState,
  recordTelemetryInterrupt,
  recordTelemetryPromptDuration,
  recordTelemetryTraceContext,
} from "./run";
import type { TelemetryRequest } from "./transport";

const SPAN_NAME = "storyblok.cli.command";
const COMMAND_COUNTER = "storyblok.cli.command.count";
const ERROR_COUNTER = "storyblok.cli.error.count";

/** `findings`: a non-zero exit without an error, e.g. `schema diff --exit-code` found differences. */
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

/**
 * Asks once, on the first interactive run. Without a TTY or in CI nobody can answer, a container
 * would ask on every run, and a coding agent's answer isn't the user's, so telemetry stays off
 * there until `storyblok telemetry enable`.
 */
export async function promptForTelemetryConsent(): Promise<void> {
  if (
    !isInteractive() ||
    isCi() ||
    isContainer() ||
    getAgent() !== undefined ||
    isTelemetryDebugEnabled()
  ) {
    return;
  }
  const status = await getTelemetryStatus();
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
          `  Privacy policy: ${PRIVACY_NOTICE_URL}`,
          `  Opt out at any time with ${disableCommand}.`,
          "  Share usage data?",
        ].join("\n"),
        default: false,
      },
      stderrPromptContext,
    );
    await saveConsent(enabled);
  } catch (error) {
    // Ctrl+C aborts the run as at any other prompt. Anything else must not stop the command.
    if (getErrorType(error) === CANCELED) {
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
    // While the pager runs, Ctrl+C is meant for it.
    if (isPagerOpen()) {
      return;
    }
    // A second Ctrl+C kills the process right away.
    process.off("SIGINT", onInterrupt);
    recordTelemetryInterrupt();
    void sendTelemetry({
      program,
      startTime: performance.timeOrigin,
      exitCode: EXIT_CODE_INTERRUPTED,
    }).finally(() => process.kill(process.pid, "SIGINT"));
  };
  process.on("SIGINT", onInterrupt);
}

/** Call after the consent prompt and before the first request to the Storyblok API. */
export async function startTelemetryRun(program: Command): Promise<void> {
  try {
    const { enabled } = await getTelemetryStatus();
    if (enabled) {
      recordTelemetryTraceContext(createTraceContext());
    }
    if (enabled || isTelemetryDebugEnabled()) {
      listenForInterrupt(program);
    }
  } catch {
    // Without a readable consent, the run isn't recorded.
  }
}

function getOutcome(errorType: string | undefined, exitCode: number): Outcome {
  if (errorType === CANCELED) {
    return "canceled";
  }
  // Some commands log a failed item and still succeed, e.g. by fetching it another way.
  if (exitCode === 0) {
    return "success";
  }
  return errorType ? "error" : "findings";
}

function prefixKeys(prefix: string, values: Attributes): Attributes {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [prefix + key, value]));
}

export type TelemetryRun = {
  program: Command;
  /** Epoch milliseconds, ideally `performance.timeOrigin` so startup counts. */
  startTime: number;
  endTime?: number;
  exitCode: number;
};

export function buildTelemetryPayloads(input: TelemetryRun, installId: string | undefined) {
  const run = getRunState();
  const { version } = getPackageJson();
  // Time spent answering the consent prompt isn't time the command took.
  const startTime = input.startTime + (run.promptDurationMs ?? 0);
  const endTime = input.endTime ?? Date.now();
  const invocation = describeInvocation(run.command ?? input.program, run.argsProcessed === true);
  const outcome = getOutcome(run.errorType, input.exitCode);
  const errorType = outcome === "error" ? run.errorType : undefined;

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

function writeDebugOutput(url: string, payload: unknown): void {
  process.stderr.write(
    `[telemetry] POST ${url} (debug mode, not sent)\n${JSON.stringify(payload, null, 2)}\n`,
  );
}

/**
 * Dash0 takes about a second to answer and drops a request whose client hangs up early, so a
 * detached process waits for it and the run exits right away. Resolves once the requests are
 * handed over.
 */
function sendDetached(requests: readonly TelemetryRequest[]): Promise<void> {
  return new Promise((resolve) => {
    try {
      const child = spawn(
        process.execPath,
        [fileURLToPath(new URL(`${TELEMETRY_SENDER_ENTRY}.mjs`, import.meta.url))],
        { detached: true, stdio: ["pipe", "ignore", "ignore"], windowsHide: true },
      );
      child.on("error", () => resolve());
      child.stdin?.on("error", () => resolve());
      child.unref();
      child.stdin?.end(JSON.stringify(requests), () => resolve());
    } catch {
      resolve();
    }
  });
}

/** Never throws or waits for the endpoint, so telemetry can't break or stall a command. */
export async function sendTelemetry(input: TelemetryRun): Promise<void> {
  try {
    if (!claimTelemetrySend()) {
      return;
    }
    const debug = isTelemetryDebugEnabled();
    const status = await getTelemetryStatus();
    if (!status.enabled && !debug) {
      return;
    }

    const installId = status.enabled ? status.installId : REDACTED;
    const { traces, metrics } = buildTelemetryPayloads(input, installId);
    const payloads = [
      { url: `${TELEMETRY_ENDPOINT}/v1/traces`, payload: traces },
      { url: `${TELEMETRY_ENDPOINT}/v1/metrics`, payload: metrics },
    ];

    if (debug) {
      payloads.forEach(({ url, payload }) => writeDebugOutput(url, payload));
      return;
    }

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TELEMETRY_AUTH_TOKEN}`,
      "Dash0-Dataset": TELEMETRY_DATASET,
    };
    const requests = payloads.map(({ url, payload }) => ({
      url,
      headers,
      body: JSON.stringify(payload),
    }));
    await sendDetached(requests);
  } catch {
    // See above.
  }
}
