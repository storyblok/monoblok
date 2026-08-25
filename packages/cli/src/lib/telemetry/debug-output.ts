import type { Attributes } from "@opentelemetry/api";
import type { ExportDisabledReason, TelemetrySettings } from "./config";

export interface TelemetryDebugReport {
  /** Span name, i.e. the command path. */
  name: string;
  resourceAttributes: Attributes;
  spanAttributes: Attributes;
  settings: TelemetrySettings;
  /** Present only when a span was actually created, which needs an export destination. */
  traceId?: string;
}

const EXPORT_DISABLED_EXPLANATION: Record<ExportDisabledReason, string> = {
  "do-not-track": "not exported: DO_NOT_TRACK is set",
  "opted-out": "not exported: telemetry is off (enable with --telemetry-enabled)",
  "no-token": "not exported: DASH0_TOKEN is not set",
};

/**
 * Render what the run reports, as the exporter would see it. This is the answer to "why
 * does nothing show up in Dash0", so the destination line matters as much as the
 * attributes: it either names the endpoint and the trace id to look up, or says exactly
 * which switch kept the span at home.
 */
export function formatTelemetryDebugReport(report: TelemetryDebugReport): string {
  const { settings } = report;
  const lines = [`[telemetry] ${report.name}`];

  for (const [key, value] of collectAttributes(report)) {
    lines.push(`  ${key.padEnd(24)} ${formatValue(value)}`);
  }

  if (settings.exportDisabledReason) {
    lines.push(`  → ${EXPORT_DISABLED_EXPLANATION[settings.exportDisabledReason]}`);
  } else {
    lines.push(`  → ${settings.endpoint}/v1/traces (dataset: ${settings.dataset})`);
    if (report.traceId) {
      lines.push(`  → trace id: ${report.traceId}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function collectAttributes(report: TelemetryDebugReport): [string, unknown][] {
  return [...Object.entries(report.resourceAttributes), ...Object.entries(report.spanAttributes)];
}

function formatValue(value: unknown): string {
  return Array.isArray(value) ? `[${value.join(", ")}]` : String(value);
}
