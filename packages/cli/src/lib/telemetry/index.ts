import type { Attributes, Span } from "@opentelemetry/api";
import { getLogger } from "../logger/logger";
import type { CommandInfo } from "./attributes";
import {
  buildCommandAttributes,
  buildErrorAttributes,
  buildResourceAttributes,
} from "./attributes";
import type { TelemetrySettings } from "./config";
import { isCiEnvironment, resolveTelemetrySettings } from "./config";
import { ATTRIBUTE_PREFIX, EXPORT_TIMEOUT_MS, INSTRUMENTATION_SCOPE } from "./constants";
import { formatTelemetryDebugReport } from "./debug-output";

export { collectExplicitFlags } from "./attributes";

export interface StartTelemetryInput extends CommandInfo {
  /** `telemetry.enabled` from the resolved config; `undefined` leaves it to the environment. */
  enabled?: boolean;
  /** `telemetry.debug` from the resolved config; `undefined` leaves it to the environment. */
  debug?: boolean;
  cliVersion: string;
}

interface ActiveRun {
  name: string;
  settings: TelemetrySettings;
  resourceAttributes: Attributes;
  /** Grows as the run progresses; the same object the span and the debug report read. */
  spanAttributes: Attributes;
  /** Null on a debug-only run, where no SDK is ever loaded. */
  span: Span | null;
  /** `SpanStatusCode.ERROR`, kept from the run's own import of the API package. */
  errorStatusCode: number | null;
  shutdown: (() => Promise<unknown>) | null;
  failed: boolean;
}

let activeRun: ActiveRun | null = null;

/**
 * Open the span that covers one CLI run.
 *
 * Every OpenTelemetry package is imported lazily and only when there is somewhere to
 * export to, so neither a run with telemetry off — the default — nor a debug-only run
 * pays for the SDK. Failures are swallowed: telemetry must never break or slow down the
 * command it measures.
 */
export async function startTelemetry(input: StartTelemetryInput): Promise<void> {
  const settings = resolveTelemetrySettings({ enabled: input.enabled, debug: input.debug });
  if (!settings) {
    return;
  }

  activeRun = {
    name: input.command,
    settings,
    resourceAttributes: buildResourceAttributes({
      serviceName: settings.serviceName,
      cliVersion: input.cliVersion,
      nodeVersion: process.versions.node,
      platform: process.platform,
      arch: process.arch,
      ci: isCiEnvironment(),
    }),
    spanAttributes: buildCommandAttributes(input),
    span: null,
    errorStatusCode: null,
    shutdown: null,
    failed: false,
  };

  // Debug-only run: the report is rendered from the attributes above, so there is nothing
  // to load and nothing to send.
  if (!settings.token) {
    return;
  }

  try {
    const [api, sdk, exporterModule, resources] = await Promise.all([
      import("@opentelemetry/api"),
      import("@opentelemetry/sdk-trace-base"),
      import("@opentelemetry/exporter-trace-otlp-http"),
      import("@opentelemetry/resources"),
    ]);

    const exporter = new exporterModule.OTLPTraceExporter({
      url: `${settings.endpoint}/v1/traces`,
      headers: {
        Authorization: `Bearer ${settings.token}`,
        "Dash0-Dataset": settings.dataset,
      },
      timeoutMillis: EXPORT_TIMEOUT_MS,
    });

    const provider = new sdk.BasicTracerProvider({
      resource: resources
        .defaultResource()
        .merge(resources.resourceFromAttributes(activeRun.resourceAttributes)),
      spanProcessors: [new sdk.BatchSpanProcessor(exporter)],
    });

    // The command path already starts with the program name ("storyblok components pull"),
    // which is exactly the span name we want.
    activeRun.span = provider
      .getTracer(INSTRUMENTATION_SCOPE, input.cliVersion)
      .startSpan(activeRun.name, { attributes: activeRun.spanAttributes });
    activeRun.errorStatusCode = api.SpanStatusCode.ERROR;
    activeRun.shutdown = () => provider.shutdown();
  } catch (error) {
    debug("Telemetry could not be started", error);
  }
}

/**
 * Tag the run with the failure that is about to be reported to the user. Called from the
 * CLI's error funnel, so it is a no-op whenever telemetry is off.
 */
export function recordTelemetryError(error: unknown): void {
  if (!activeRun) {
    return;
  }
  try {
    const attributes = buildErrorAttributes(error);
    Object.assign(activeRun.spanAttributes, attributes);
    activeRun.failed = true;

    if (activeRun.span && activeRun.errorStatusCode !== null) {
      activeRun.span.setAttributes(attributes);
      activeRun.span.setStatus({
        code: activeRun.errorStatusCode,
        message: String(attributes["error.type"]),
      });
    }
  } catch (recordError) {
    debug("Telemetry could not record an error", recordError);
  }
}

/**
 * Close the run: print the debug report when asked for one, then flush. The flush is
 * raced against {@link EXPORT_TIMEOUT_MS} so a slow or unreachable ingress delays the exit
 * by at most that long.
 */
export async function finishTelemetry(input: { exitCode?: number } = {}): Promise<void> {
  const run = activeRun;
  activeRun = null;
  if (!run) {
    return;
  }

  try {
    const exitCode = Number(input.exitCode ?? 0);
    run.spanAttributes[`${ATTRIBUTE_PREFIX}.exit_code`] = exitCode;
    run.spanAttributes[`${ATTRIBUTE_PREFIX}.outcome`] = exitCode === 0 ? "success" : "error";

    if (run.span) {
      run.span.setAttribute(`${ATTRIBUTE_PREFIX}.exit_code`, exitCode);
      run.span.setAttribute(`${ATTRIBUTE_PREFIX}.outcome`, exitCode === 0 ? "success" : "error");
      // A command can fail without going through the error funnel — an exit code that was
      // set directly still has to mark the span as failed.
      if (exitCode !== 0 && !run.failed && run.errorStatusCode !== null) {
        run.span.setStatus({ code: run.errorStatusCode });
      }
      run.span.end();
    }

    // Printed before the flush is awaited, so the report shows up immediately even when
    // the ingress is slow.
    if (run.settings.debug) {
      writeDebugReport(run);
    }

    if (run.shutdown) {
      await withTimeout(run.shutdown(), EXPORT_TIMEOUT_MS);
    }
  } catch (error) {
    debug("Telemetry could not be flushed", error);
  }
}

/** Test seam: drop any run left open by a previous test. */
export function resetTelemetry(): void {
  activeRun = null;
}

function writeDebugReport(run: ActiveRun): void {
  try {
    // Written straight to stderr on purpose: this is a developer channel, so it must not
    // be silenced by `--no-ui-enabled` or the log level, and must stay off stdout.
    process.stderr.write(
      formatTelemetryDebugReport({
        name: run.name,
        resourceAttributes: run.resourceAttributes,
        spanAttributes: run.spanAttributes,
        settings: run.settings,
        traceId: run.span?.spanContext().traceId,
      }),
    );
  } catch (error) {
    debug("Telemetry could not print its debug report", error);
  }
}

async function withTimeout(promise: Promise<unknown>, timeoutMs: number): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
    // Never let the pending flush keep the process alive on its own.
    timer.unref?.();
  });
  try {
    await Promise.race([promise, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function debug(message: string, error: unknown): void {
  try {
    getLogger().debug(message, { error: error instanceof Error ? error : String(error) });
  } catch {
    // Diagnostics about telemetry must not become an error of their own.
  }
}
