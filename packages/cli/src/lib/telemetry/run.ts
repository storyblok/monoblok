import type { Command } from "commander";
import { regionCodes, type RegionCode } from "../../constants";
import { CANCELED, getErrorType } from "./error-type";
import type { TraceContext } from "./otlp";

const SPACE_ID_PATTERN = /^\d{1,20}$/;

type RunState = {
  errorType?: string;
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

/** The first error is the one that ended the run, or the first of a batch's failed items. */
export function recordTelemetryError(error: unknown): void {
  run.errorType ??= getErrorType(error);
}

export function recordTelemetryInterrupt(): void {
  run.errorType = CANCELED;
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

/** True only on the first call, so a run is sent once even when Ctrl+C races the final send. */
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
 * W3C trace context for requests to the Storyblok API, so their spans join the run's trace.
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
