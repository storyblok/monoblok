import { describe, expect, it } from "vitest";
import { formatTelemetryDebugReport } from "./debug-output";
import type { TelemetrySettings } from "./config";

const EXPORTING: TelemetrySettings = {
  endpoint: "https://ingress.eu-west-1.aws.dash0.com",
  token: "ingest-token",
  dataset: "prd-storyblok-cli",
  serviceName: "storyblok-cli",
  debug: true,
};

const report = {
  name: "storyblok components pull",
  resourceAttributes: { "service.name": "storyblok-cli", "service.version": "4.22.2" },
  spanAttributes: {
    "sb.cli.command": "storyblok components pull",
    "sb.cli.flags": ["--space"],
    "sb.cli.outcome": "success",
  },
  settings: EXPORTING,
};

describe("formatTelemetryDebugReport", () => {
  it("should list every attribute the run reports", () => {
    const output = formatTelemetryDebugReport(report);

    expect(output).toContain("[telemetry] storyblok components pull");
    expect(output).toMatch(/service\.version\s+4\.22\.2/);
    expect(output).toMatch(/sb\.cli\.command\s+storyblok components pull/);
    expect(output).toMatch(/sb\.cli\.flags\s+\[--space\]/);
  });

  it("should name the destination and the trace id when the run is exported", () => {
    const output = formatTelemetryDebugReport({ ...report, traceId: "abc123" });

    expect(output).toContain(
      "→ https://ingress.eu-west-1.aws.dash0.com/v1/traces (dataset: prd-storyblok-cli)",
    );
    expect(output).toContain("→ trace id: abc123");
  });

  it.each([
    ["do-not-track", "not exported: DO_NOT_TRACK is set"],
    ["opted-out", "not exported: telemetry is off (enable with --telemetry-enabled)"],
    ["no-token", "not exported: DASH0_TOKEN is not set"],
  ] as const)("should explain %s instead of naming a destination", (reason, explanation) => {
    const output = formatTelemetryDebugReport({
      ...report,
      settings: { ...EXPORTING, token: "", exportDisabledReason: reason },
    });

    expect(output).toContain(explanation);
    expect(output).not.toContain("/v1/traces");
  });

  it("should never print the token", () => {
    expect(formatTelemetryDebugReport(report)).not.toContain("ingest-token");
  });
});
