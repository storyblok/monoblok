import { beforeEach, describe, expect, it, vi } from "vitest";
import { finishTelemetry, recordTelemetryError, resetTelemetry, startTelemetry } from "./index";

const mocks = vi.hoisted(() => {
  const span = {
    setAttribute: vi.fn(),
    setAttributes: vi.fn(),
    setStatus: vi.fn(),
    end: vi.fn(),
    spanContext: () => ({ traceId: "trace-abc", spanId: "span-abc", traceFlags: 1 }),
  };
  return {
    span,
    startSpan: vi.fn(() => span),
    shutdown: vi.fn(() => Promise.resolve()),
    exporterConfigs: [] as any[],
    providerConfigs: [] as any[],
  };
});

vi.mock("@opentelemetry/api", () => ({
  SpanStatusCode: { UNSET: 0, OK: 1, ERROR: 2 },
}));

vi.mock("@opentelemetry/sdk-trace-base", () => ({
  BasicTracerProvider: class {
    constructor(config: unknown) {
      mocks.providerConfigs.push(config);
    }

    getTracer() {
      return { startSpan: mocks.startSpan };
    }

    shutdown() {
      return mocks.shutdown();
    }
  },
  BatchSpanProcessor: class {
    constructor(public exporter: unknown) {}
  },
}));

vi.mock("@opentelemetry/exporter-trace-otlp-http", () => ({
  OTLPTraceExporter: class {
    constructor(config: unknown) {
      mocks.exporterConfigs.push(config);
    }
  },
}));

vi.mock("@opentelemetry/resources", () => ({
  defaultResource: () => ({ merge: (other: unknown) => other }),
  resourceFromAttributes: (attributes: unknown) => ({ attributes }),
}));

const RUN = {
  command: "storyblok components pull",
  flags: ["--space"],
  region: "eu",
  runId: 1737000000000,
  cliVersion: "4.22.2",
};

function enableTelemetry(): void {
  vi.stubEnv("STORYBLOK_TELEMETRY_ENABLED", "1");
  vi.stubEnv("DASH0_TOKEN", "ingest-token");
}

function captureStderr(): { output: () => string } {
  const chunks: string[] = [];
  vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
    chunks.push(String(chunk));
    return true;
  });
  return { output: () => chunks.join("") };
}

describe("telemetry lifecycle", () => {
  beforeEach(() => {
    resetTelemetry();
    vi.unstubAllEnvs();
    vi.stubEnv("DO_NOT_TRACK", "");
    vi.stubEnv("STORYBLOK_TELEMETRY_ENABLED", "");
    vi.stubEnv("DASH0_TOKEN", "");
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mocks.exporterConfigs.length = 0;
    mocks.providerConfigs.length = 0;
  });

  it("should not load the OpenTelemetry SDK when telemetry is off", async () => {
    await startTelemetry(RUN);

    expect(mocks.startSpan).not.toHaveBeenCalled();

    await finishTelemetry({ exitCode: 0 });

    expect(mocks.shutdown).not.toHaveBeenCalled();
  });

  it("should point the exporter at the Dash0 traces endpoint with the dataset header", async () => {
    enableTelemetry();
    vi.stubEnv("DASH0_DATASET", "dev-storyblok");

    await startTelemetry(RUN);

    expect(mocks.exporterConfigs[0]).toMatchObject({
      url: "https://ingress.eu-west-1.aws.dash0.com/v1/traces",
      headers: {
        Authorization: "Bearer ingest-token",
        "Dash0-Dataset": "dev-storyblok",
      },
    });
  });

  it("should open one span per run, named after the command", async () => {
    enableTelemetry();

    await startTelemetry(RUN);

    expect(mocks.startSpan).toHaveBeenCalledWith("storyblok components pull", {
      attributes: {
        "sb.cli.command": "storyblok components pull",
        "sb.cli.flags": ["--space"],
        "sb.cli.region": "eu",
        "sb.cli.run_id": "1737000000000",
      },
    });
  });

  it("should close a successful run and flush it", async () => {
    enableTelemetry();

    await startTelemetry(RUN);
    await finishTelemetry({ exitCode: 0 });

    expect(mocks.span.setAttribute).toHaveBeenCalledWith("sb.cli.exit_code", 0);
    expect(mocks.span.setAttribute).toHaveBeenCalledWith("sb.cli.outcome", "success");
    expect(mocks.span.setStatus).not.toHaveBeenCalled();
    expect(mocks.span.end).toHaveBeenCalledTimes(1);
    expect(mocks.shutdown).toHaveBeenCalledTimes(1);
  });

  it("should tag the span with a reported failure", async () => {
    enableTelemetry();

    await startTelemetry(RUN);
    recordTelemetryError(Object.assign(new Error("nope"), { name: "API Error", code: 401 }));
    await finishTelemetry({ exitCode: 1 });

    expect(mocks.span.setAttributes).toHaveBeenCalledWith({
      "error.type": "API Error",
      "http.response.status_code": 401,
    });
    expect(mocks.span.setStatus).toHaveBeenCalledWith({ code: 2, message: "API Error" });
    expect(mocks.span.setAttribute).toHaveBeenCalledWith("sb.cli.outcome", "error");
  });

  it("should mark a failure that never reached the error funnel", async () => {
    enableTelemetry();

    await startTelemetry(RUN);
    await finishTelemetry({ exitCode: 2 });

    expect(mocks.span.setStatus).toHaveBeenCalledWith({ code: 2 });
  });

  it("should give up on a flush that outlives the export timeout", async () => {
    enableTelemetry();
    mocks.shutdown.mockReturnValueOnce(new Promise<void>(() => {}));

    await startTelemetry(RUN);
    vi.useFakeTimers();
    try {
      const finished = finishTelemetry({ exitCode: 0 });
      await vi.advanceTimersByTimeAsync(3000);
      await expect(finished).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("should print the run without loading the SDK when only debug is on", async () => {
    vi.stubEnv("STORYBLOK_TELEMETRY_DEBUG", "1");
    const stderr = captureStderr();

    await startTelemetry(RUN);

    expect(mocks.startSpan).not.toHaveBeenCalled();

    await finishTelemetry({ exitCode: 0 });

    const output = stderr.output();
    expect(output).toContain("[telemetry] storyblok components pull");
    expect(output).toMatch(/sb\.cli\.outcome\s+success/);
    expect(output).toContain("not exported: telemetry is off");
    expect(mocks.shutdown).not.toHaveBeenCalled();
  });

  it("should print and export when debug accompanies an opt-in", async () => {
    enableTelemetry();
    vi.stubEnv("STORYBLOK_TELEMETRY_DEBUG", "1");
    const stderr = captureStderr();

    await startTelemetry(RUN);
    await finishTelemetry({ exitCode: 0 });

    expect(stderr.output()).toContain("→ trace id: trace-abc");
    expect(mocks.startSpan).toHaveBeenCalledTimes(1);
    expect(mocks.shutdown).toHaveBeenCalledTimes(1);
  });

  it("should print the failure attributes of a failed run", async () => {
    vi.stubEnv("STORYBLOK_TELEMETRY_DEBUG", "1");
    const stderr = captureStderr();

    await startTelemetry(RUN);
    recordTelemetryError(Object.assign(new Error("nope"), { name: "API Error", code: 401 }));
    await finishTelemetry({ exitCode: 1 });

    const output = stderr.output();
    expect(output).toMatch(/error\.type\s+API Error/);
    expect(output).toMatch(/http\.response\.status_code\s+401/);
    expect(output).toMatch(/sb\.cli\.outcome\s+error/);
  });

  it("should stay silent when debug is off", async () => {
    enableTelemetry();
    const stderr = captureStderr();

    await startTelemetry(RUN);
    await finishTelemetry({ exitCode: 0 });

    expect(stderr.output()).toBe("");
  });

  it("should ignore an error reported outside a run", () => {
    expect(() => recordTelemetryError(new Error("boom"))).not.toThrow();
  });
});
