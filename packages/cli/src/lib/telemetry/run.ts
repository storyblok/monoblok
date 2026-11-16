import { CommanderError } from "commander";
import type { Command } from "commander";
import { regionCodes, type RegionCode } from "../../constants";
import { isPromptCancellation } from "../../utils/error/inspect";
import type { TelemetryStatus } from "./consent";
import type { TraceContext } from "./otlp";

const SPACE_ID_PATTERN = /^\d{1,20}$/;

type RunState = {
  /** The first error: the one that ended the run, or the first of a batch's failed items. */
  error?: unknown;
  canceled?: boolean;
  hasFindings?: boolean;
  /** The consent the run started with. Sending also requires the consent current at that time. */
  status?: TelemetryStatus;
  spaceId?: string;
  region?: RegionCode;
  /** The deepest command Commander dispatched to, even if it then rejected the input. */
  command?: Command;
  argsProcessed?: boolean;
  promptDurationMs?: number;
  /** Only set when telemetry is enabled, so only consenting runs link their API requests. */
  traceContext?: TraceContext;
  sent?: boolean;
};

let run: RunState = {};

export function getRunState(): Readonly<RunState> {
  return run;
}

export function resetTelemetryRun(): void {
  run = {};
}

export function recordTelemetryError(error: unknown): void {
  if (isPromptCancellation(error)) {
    run.canceled = true;
    return;
  }
  run.error ??= error;
}

export function recordTelemetryInterrupt(): void {
  run.canceled = true;
}

/** For a non-zero exit that reports a result, e.g. `schema diff --exit-code` found differences. */
export function recordTelemetryFindings(): void {
  run.hasFindings = true;
}

export function recordTelemetryStatus(status: TelemetryStatus): void {
  run.status = status;
}

export function recordTelemetrySpaceId(space: unknown): void {
  const value = typeof space === "number" ? String(space) : space;
  if (typeof value === "string" && SPACE_ID_PATTERN.test(value)) {
    run.spaceId = value;
  }
}

export function recordTelemetryRegion(region: unknown): void {
  run.region = regionCodes.find((code) => code === region);
}

/**
 * Commander ends a run that printed help or the version with exit code 0. Those aren't runs of the
 * command, and would inflate its usage, so nothing is sent.
 */
export function recordTelemetryCommanderExit(error: unknown): void {
  if (error instanceof CommanderError && error.exitCode === 0) {
    run.sent = true;
  }
}

/** True only on the first call, so a run is sent once even when Ctrl+C races the exit. */
export function claimTelemetrySend(): boolean {
  if (run.sent) {
    return false;
  }
  run.sent = true;
  return true;
}

export function getTelemetryTraceId(): string | undefined {
  return run.traceContext?.traceId;
}

export function recordTelemetryTraceContext(context: TraceContext): void {
  run.traceContext = context;
}

/**
 * W3C trace context for requests to the Management API, so their spans join the run's trace.
 * Always flagged as sampled, so every run's requests are kept.
 */
export function getTelemetryTraceHeaders(): Record<string, string> {
  const { traceContext } = run;
  return traceContext
    ? { traceparent: `00-${traceContext.traceId}-${traceContext.spanId}-01` }
    : {};
}

export function recordTelemetryPromptDuration(durationMs: number): void {
  run.promptDurationMs = durationMs;
}

/**
 * Register before any other `preAction` hook, so a run that fails in one is still attributed to
 * its command.
 */
export function trackTelemetryInvocation(program: Command): void {
  // Hooks only fire for the command they are registered on, so each level registers the next.
  const hooked = new WeakSet<Command>();
  const onSubcommand = (_parent: Command, subcommand: Command) => {
    run.command = subcommand;
    if (!hooked.has(subcommand)) {
      hooked.add(subcommand);
      subcommand.hook("preSubcommand", onSubcommand);
    }
  };
  program.hook("preSubcommand", onSubcommand);
  program.hook("preAction", (_command, actionCommand) => {
    run.command = actionCommand;
    run.argsProcessed = true;
  });
}
