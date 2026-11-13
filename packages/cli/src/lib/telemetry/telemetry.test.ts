import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ChildProcess, spawn } from "node:child_process";
import { PassThrough } from "node:stream";
import { Argument, Command, Option } from "commander";
import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { vol } from "memfs";
import { confirm } from "@inquirer/prompts";
import { detectAgent, detectProvider } from "std-env";
import { APIError } from "../../utils/error/api-error";
import { NotLoggedInError } from "../../utils/error/command-error";
import { FetchError } from "../../utils/fetch";
import { redactClientError } from "../../utils/error/redact";
import { createMapiClient } from "../../api";
import { getConsentFilePath } from "./consent";
import { TELEMETRY_SCHEMA_VERSION } from "./config";
import {
  recordTelemetryError,
  recordTelemetryInterrupt,
  recordTelemetryRegion,
  recordTelemetrySpaceId,
  resetTelemetryRun,
  trackTelemetryInvocation,
} from "./run";
import { runSender } from "./sender";
import { promptForTelemetryConsent, sendTelemetry, startTelemetryRun } from "./telemetry";

const { ENDPOINT, AUTH_TOKEN } = vi.hoisted(() => ({
  ENDPOINT: "https://telemetry.test",
  AUTH_TOKEN: "test-ingest-token",
}));

vi.mock("./config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./config")>()),
  TELEMETRY_ENDPOINT: ENDPOINT,
  TELEMETRY_AUTH_TOKEN: AUTH_TOKEN,
}));
vi.mock("std-env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("std-env")>()),
  detectAgent: vi.fn(() => ({})),
  detectProvider: vi.fn(() => ({ name: "", ci: false })),
}));
vi.mock("@inquirer/prompts", () => ({ confirm: vi.fn() }));
vi.mock("node:child_process", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:child_process")>()),
  spawn: vi.fn(),
}));

const MAPI_URL = "https://mapi.storyblok.com";
const INSTALL_ID = "3f0c1d9e-1111-4222-8333-944455556666";
const START_TIME = 1_700_000_000_000;

type OtlpKeyValue = { key: string; value: Record<string, unknown> };
type Received = { url: string; headers: Headers; body: any };

const received: Received[] = [];
/** The detached sender, run in-process so the test can see what it posts. */
const senders: Promise<void>[] = [];

function runSenderInProcess() {
  const child = new ChildProcess();
  const stdin = new PassThrough();
  child.stdin = stdin;
  senders.push(runSender(stdin, 200));
  return child;
}
const mapiRequests: Request[] = [];
const server = setupServer(
  http.post(`${ENDPOINT}/v1/*`, async ({ request }) => {
    received.push({ url: request.url, headers: request.headers, body: await request.json() });
    return new HttpResponse(null, { status: 200 });
  }),
  http.get(`${MAPI_URL}/*`, ({ request }) => {
    mapiRequests.push(request);
    return HttpResponse.json({ user: {} });
  }),
);

function createProgram() {
  const program = new Command("storyblok")
    .exitOverride()
    .configureOutput({ writeErr: () => {}, writeOut: () => {} })
    .option("--verbose")
    .option("--color", "colored output", true)
    .option("--no-color");
  const components = program.command("components").alias("comp");
  components
    .command("push")
    .argument("[componentName]")
    .option("-s, --space <space>", "space ID")
    .option("--dry-run")
    .addOption(new Option("--format <format>", "output format").choices(["pretty", "json"]))
    .option("--limit <limit>", "max items", (value) => Number.parseInt(value, 10))
    .option("--token <token>")
    .option("--starts-with <path>")
    .action(() => {});
  program
    .command("validate")
    .addArgument(new Argument("<entry-file>"))
    .action(() => {});
  program.command("user").action(async () => {
    await createMapiClient({ personalAccessToken: "test-token" }).users.me();
  });
  trackTelemetryInvocation(program);
  program.hook("preAction", (thisCommand) => startTelemetryRun(thisCommand));
  return program;
}

function storeConsent(consent: Record<string, unknown>) {
  vol.fromJSON({
    [getConsentFilePath()]: JSON.stringify({ decidedAt: "2026-01-01T00:00:00.000Z", ...consent }),
  });
}

const preconditions = {
  consentGiven() {
    storeConsent({ enabled: true, schemaVersion: TELEMETRY_SCHEMA_VERSION, installId: INSTALL_ID });
  },
  consentDeclined() {
    storeConsent({ enabled: false, schemaVersion: TELEMETRY_SCHEMA_VERSION });
  },
  consentGivenForOlderSchema() {
    storeConsent({
      enabled: true,
      schemaVersion: TELEMETRY_SCHEMA_VERSION - 1,
      installId: INSTALL_ID,
    });
  },
  envSet(name: string, value = "1") {
    vi.stubEnv(name, value);
  },
  runsInAgent(name: string) {
    vi.mocked(detectAgent).mockReturnValue({ name });
  },
  runsInCiProvider(name: string) {
    vi.mocked(detectProvider).mockReturnValue({ name, ci: true });
  },
  ingestionHangs() {
    server.use(http.post(`${ENDPOINT}/v1/*`, () => delay("infinite")));
  },
  ingestionFails() {
    server.use(http.post(`${ENDPOINT}/v1/*`, () => HttpResponse.error()));
  },
  senderCannotStart() {
    vi.mocked(spawn).mockImplementation(() => {
      throw new Error("spawn EPERM");
    });
  },
};

let sigintListenersBefore: Function[] = [];

const rateLimitError = () =>
  new APIError(
    "generic",
    "pull_stories",
    new FetchError("Too Many Requests", { status: 429, statusText: "Too Many Requests" }),
  );

async function run(argv: string[], { exitCode = 0, endTime = START_TIME + 250 } = {}) {
  const program = createProgram();
  try {
    await program.parseAsync(argv, { from: "user" });
  } catch {
    // Commander rejected the input; telemetry still records the run.
  }
  await sendTelemetry({ program, startTime: START_TIME, endTime, exitCode });
  await Promise.all(senders);
}

function sent(path: "traces" | "metrics") {
  return received.find(({ url }) => url.endsWith(`/v1/${path}`));
}

function sentSpan() {
  return sent("traces")?.body.resourceSpans[0].scopeSpans[0].spans[0];
}

function spanAttributes(): Record<string, unknown> {
  return Object.fromEntries(
    sentSpan().attributes.map(({ key, value }: OtlpKeyValue) => [key, Object.values(value)[0]]),
  );
}

function metricNames(): string[] {
  return sent("metrics")?.body.resourceMetrics[0].scopeMetrics[0].metrics.map(
    ({ name }: { name: string }) => name,
  );
}

function commandCounterAttributes(): Record<string, unknown> {
  const [counter] = sent("metrics")?.body.resourceMetrics[0].scopeMetrics[0].metrics ?? [];
  return Object.fromEntries(
    counter.sum.dataPoints[0].attributes.map(({ key, value }: OtlpKeyValue) => [
      key,
      Object.values(value)[0],
    ]),
  );
}

function sentText(): string {
  return JSON.stringify(received.map(({ body }) => body));
}

describe("telemetry", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterAll(() => server.close());

  beforeEach(() => {
    received.length = 0;
    senders.length = 0;
    mapiRequests.length = 0;
    vi.mocked(spawn).mockImplementation(runSenderInProcess);
    resetTelemetryRun();
    sigintListenersBefore = process.listeners("SIGINT");
    vi.spyOn(process, "kill").mockImplementation(() => true);
    vi.stubEnv("DO_NOT_TRACK", "");
    vi.stubEnv("STORYBLOK_TELEMETRY_DISABLED", "");
    vi.stubEnv("STORYBLOK_TELEMETRY_DEBUG", "");
    vi.stubEnv("CI", "");
    vi.stubEnv("TF_BUILD", "");
  });

  afterEach(() => {
    for (const listener of process.listeners("SIGINT")) {
      if (!sigintListenersBefore.includes(listener)) {
        process.off("SIGINT", listener);
      }
    }
    server.resetHandlers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.mocked(detectAgent).mockReturnValue({});
    vi.mocked(detectProvider).mockReturnValue({ name: "", ci: false });
    for (const stream of [process.stdin, process.stderr]) {
      Object.defineProperty(stream, "isTTY", { value: false, configurable: true, writable: true });
    }
  });

  describe("consent", () => {
    it("should send nothing before the user has been asked", async () => {
      await run(["components", "push"]);

      expect(received).toHaveLength(0);
    });

    it("should send nothing when the user declined", async () => {
      preconditions.consentDeclined();

      await run(["components", "push"]);

      expect(received).toHaveLength(0);
    });

    it("should send nothing when consent was given for an older data schema", async () => {
      preconditions.consentGivenForOlderSchema();

      await run(["components", "push"]);

      expect(received).toHaveLength(0);
    });

    it.each(["DO_NOT_TRACK", "STORYBLOK_TELEMETRY_DISABLED"])(
      "should send nothing when %s is set, even with consent",
      async (variable) => {
        preconditions.consentGiven();
        preconditions.envSet(variable);

        await run(["components", "push"]);

        expect(received).toHaveLength(0);
      },
    );
  });

  it("should send a span and a command counter with the ingest token", async () => {
    preconditions.consentGiven();

    await run(["components", "push"]);

    expect(sent("traces")?.headers.get("authorization")).toBe(`Bearer ${AUTH_TOKEN}`);
    expect(sentSpan().name).toBe("storyblok.cli.command");
    expect(spanAttributes()).toMatchObject({
      "storyblok.cli.command": "storyblok components push",
      "storyblok.cli.outcome": "success",
      "storyblok.cli.install.id": INSTALL_ID,
      "process.exit.code": "0",
    });
    expect(metricNames()).toEqual(["storyblok.cli.command.count"]);
  });

  it("should resolve command aliases to the command name", async () => {
    preconditions.consentGiven();

    await run(["comp", "push"]);

    expect(spanAttributes()["storyblok.cli.command"]).toBe("storyblok components push");
  });

  describe("values", () => {
    it("should send booleans, numbers, and choices typed on the command line", async () => {
      preconditions.consentGiven();

      await run(["components", "push", "--format=json", "--limit", "5", "--dry-run"]);

      expect(spanAttributes()).toMatchObject({
        "storyblok.cli.flag.format": "json",
        "storyblok.cli.flag.limit": "5",
        "storyblok.cli.flag.dry-run": true,
      });
    });

    it("should only show that other values were set", async () => {
      preconditions.consentGiven();

      await run([
        "components",
        "push",
        "Jane Doe",
        "--space",
        "12345",
        "--token",
        "sk-1",
        "--starts-with",
        "en/blog",
      ]);

      expect(spanAttributes()).toMatchObject({
        "storyblok.cli.arg.componentName": "[REDACTED]",
        "storyblok.cli.flag.space": "[REDACTED]",
        "storyblok.cli.flag.token": "[REDACTED]",
        "storyblok.cli.flag.starts-with": "[REDACTED]",
      });
      expect(sentText()).not.toContain("Jane Doe");
      expect(sentText()).not.toContain("sk-1");
      expect(sentText()).not.toContain("en/blog");
    });

    it("should leave out default values", async () => {
      preconditions.consentGiven();

      await run(["components", "push"]);

      expect(spanAttributes()).not.toHaveProperty("storyblok.cli.flag.color");
    });

    it("should report short, global, and negated flags by their long name", async () => {
      preconditions.consentGiven();

      await run(["--verbose", "--no-color", "components", "push", "-s", "12345"]);

      expect(spanAttributes()).toMatchObject({
        "storyblok.cli.flag.verbose": true,
        "storyblok.cli.flag.color": false,
        "storyblok.cli.flag.space": "[REDACTED]",
      });
    });

    it("should report the last value of a repeated flag, as the command sees it", async () => {
      preconditions.consentGiven();

      await run(["components", "push", "--limit", "1", "--limit", "2"]);

      expect(spanAttributes()["storyblok.cli.flag.limit"]).toBe("2");
    });

    it.each([
      ["a separate value", ["components", "push", "--tokn", "SECRET", "--space", "1"]],
      ["an attached value", ["components", "push", "--tokn=SECRET"]],
      ["a short flag cluster", ["components", "push", "-XsSECRET"]],
      ["a flag before the subcommand", ["--tokn", "SECRET", "components", "push"]],
    ])("should send nothing typed with an unknown flag given %s", async (_, argv) => {
      preconditions.consentGiven();

      await run(argv, { exitCode: 2 });

      expect(sentText()).not.toContain("SECRET");
      expect(sentText()).not.toContain("tokn");
      expect(spanAttributes()["error.type"]).toBeUndefined();
    });

    it("should attribute a rejected run to the command it was meant for", async () => {
      preconditions.consentGiven();

      await run(["components", "push", "--tokn", "SECRET", "--dry-run"], { exitCode: 2 });

      expect(spanAttributes()).toMatchObject({
        "storyblok.cli.command": "storyblok components push",
        "storyblok.cli.flag.dry-run": true,
      });
    });
  });

  describe("context", () => {
    it("should send the space ID of the run", async () => {
      preconditions.consentGiven();
      recordTelemetrySpaceId("12345");

      await run(["components", "push"]);

      expect(spanAttributes()["storyblok.cli.space.id"]).toBe("12345");
    });

    it("should name the coding agent running the CLI", async () => {
      preconditions.consentGiven();
      preconditions.runsInAgent("claude");

      await run(["components", "push"]);

      expect(spanAttributes()["storyblok.cli.agent"]).toBe("claude");
    });

    it("should count runs by CI and agent", async () => {
      preconditions.consentGiven();
      preconditions.envSet("CI", "true");
      preconditions.runsInAgent("claude");

      await run(["components", "push"]);

      expect(commandCounterAttributes()).toMatchObject({
        "storyblok.cli.ci": true,
        "storyblok.cli.agent": "claude",
      });
    });

    it("should reduce the agent name to its first word", async () => {
      preconditions.consentGiven();
      preconditions.runsInAgent("claude-code_2-1-322_agent");

      await run(["components", "push"]);

      expect(spanAttributes()["storyblok.cli.agent"]).toBe("claude");
    });

    it("should not pass on an agent name that doesn't start with a word", async () => {
      preconditions.consentGiven();
      preconditions.runsInAgent("/home/me/agent");

      await run(["components", "push"]);

      expect(spanAttributes()["storyblok.cli.agent"]).toBe("other");
    });

    it("should count runs by region", async () => {
      preconditions.consentGiven();
      recordTelemetryRegion("us");

      await run(["components", "push"]);

      expect(commandCounterAttributes()["storyblok.cli.region"]).toBe("us");
    });

    it.each([
      ["CI", () => preconditions.envSet("CI", "true")],
      ["Azure Pipelines", () => preconditions.envSet("TF_BUILD", "True")],
      ["a CI provider without CI set", () => preconditions.runsInCiProvider("github_actions")],
    ])("should detect %s", async (_, setUp) => {
      preconditions.consentGiven();
      setUp();

      await run(["components", "push"]);

      expect(spanAttributes()["storyblok.cli.ci"]).toBe(true);
    });

    it("should not count the time spent at the consent prompt", async () => {
      for (const stream of [process.stdin, process.stderr]) {
        Object.defineProperty(stream, "isTTY", { value: true, configurable: true, writable: true });
      }
      vi.spyOn(performance, "now").mockReturnValueOnce(0).mockReturnValueOnce(3000);
      vi.mocked(confirm).mockResolvedValue(true);
      const program = createProgram();
      await promptForTelemetryConsent();

      await sendTelemetry({
        program,
        startTime: START_TIME,
        endTime: START_TIME + 3250,
        exitCode: 0,
      });
      await Promise.all(senders);

      const span = sentSpan();
      const durationNs = BigInt(span.endTimeUnixNano) - BigInt(span.startTimeUnixNano);
      expect(durationNs).toBe(250_000_000n);
    });
  });

  describe("errors", () => {
    it("should report a normalized error type and count the error", async () => {
      preconditions.consentGiven();
      recordTelemetryError(rateLimitError());

      await run(["components", "push"], { exitCode: 1 });

      expect(spanAttributes()).toMatchObject({
        "storyblok.cli.outcome": "error",
        "error.type": "RATE_LIMITED",
      });
      expect(metricNames()).toEqual(["storyblok.cli.command.count", "storyblok.cli.error.count"]);
    });

    it("should report the first error of a run", async () => {
      preconditions.consentGiven();
      recordTelemetryError(rateLimitError());
      recordTelemetryError(new Error("fallout"));

      await run(["components", "push"], { exitCode: 1 });

      expect(spanAttributes()["error.type"]).toBe("RATE_LIMITED");
    });

    const fetchFailed = () => new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } });
    const networkFetchError = () => {
      const error = new FetchError("fetch failed", { status: 0, statusText: "Network Error" });
      error.cause = fetchFailed();
      return error;
    };

    it.each([
      ["NOT_LOGGED_IN", "a missing login", new NotLoggedInError("not logged in")],
      ["ECONNREFUSED", "a failed fetch", fetchFailed()],
      [
        "ECONNREFUSED",
        "a wrapped failed fetch",
        new APIError("generic", "pull_stories", networkFetchError()),
      ],
      ["ECONNREFUSED", "a redacted failed fetch", redactClientError(fetchFailed())],
      ["TIMEOUT_ERROR", "a timeout", new DOMException("The operation timed out.", "TimeoutError")],
      ["TYPE_ERROR", "a built-in error", new TypeError("undefined is not a function")],
      ["SYNTAX_ERROR", "a broken user file", new SyntaxError("Unexpected token")],
      ["UNEXPECTED_ERROR", "a plain error", new Error("something")],
    ])("should report %s for %s", async (errorType, _, error) => {
      preconditions.consentGiven();
      recordTelemetryError(error);

      await run(["components", "push"], { exitCode: 1 });

      expect(spanAttributes()["error.type"]).toBe(errorType);
    });

    it("should report a non-zero exit without an error as findings", async () => {
      preconditions.consentGiven();

      await run(["components", "push"], { exitCode: 1 });

      expect(spanAttributes()["storyblok.cli.outcome"]).toBe("findings");
      expect(metricNames()).toEqual(["storyblok.cli.command.count"]);
    });

    it("should report a run that recovered from an error as a success", async () => {
      preconditions.consentGiven();
      recordTelemetryError(rateLimitError());

      await run(["components", "push"], { exitCode: 0 });

      expect(spanAttributes()["storyblok.cli.outcome"]).toBe("success");
      expect(spanAttributes()["error.type"]).toBeUndefined();
      expect(metricNames()).toEqual(["storyblok.cli.command.count"]);
    });

    it("should report an interrupted run as canceled", async () => {
      preconditions.consentGiven();
      recordTelemetryError(rateLimitError());
      recordTelemetryInterrupt();

      await run(["components", "push"], { exitCode: 130 });

      expect(spanAttributes()["storyblok.cli.outcome"]).toBe("canceled");
      expect(spanAttributes()["error.type"]).toBeUndefined();
    });
  });

  describe("interrupts", () => {
    it("should send an interrupted run and let Ctrl+C end the process", async () => {
      preconditions.consentGiven();
      await createProgram().parseAsync(["components", "push"], { from: "user" });

      process.emit("SIGINT");

      await vi.waitFor(() => expect(process.kill).toHaveBeenCalledWith(process.pid, "SIGINT"));
      await Promise.all(senders);
      expect(spanAttributes()).toMatchObject({
        "storyblok.cli.outcome": "canceled",
        "process.exit.code": "130",
      });
    });

    it("should leave Ctrl+C alone when telemetry is off", async () => {
      preconditions.consentDeclined();

      await createProgram().parseAsync(["components", "push"], { from: "user" });

      expect(process.listeners("SIGINT")).toEqual(sigintListenersBefore);
    });

    it("should send a run only once", async () => {
      preconditions.consentGiven();

      await Promise.all([run(["components", "push"]), run(["components", "push"])]);

      expect(received.map(({ url }) => new URL(url).pathname).sort()).toEqual([
        "/v1/metrics",
        "/v1/traces",
      ]);
    });
  });

  describe("trace context", () => {
    it("should link Storyblok API requests to the run's span", async () => {
      preconditions.consentGiven();

      await run(["user"]);

      const { traceId, spanId } = sentSpan();
      expect(mapiRequests[0].headers.get("traceparent")).toBe(`00-${traceId}-${spanId}-01`);
    });

    it.each([
      ["before the user has been asked", () => {}],
      ["when the user declined", preconditions.consentDeclined],
      ["when telemetry is disabled", () => preconditions.envSet("DO_NOT_TRACK")],
    ])("should not send trace context %s", async (_state, establish) => {
      establish();

      await run(["user"]);

      expect(mapiRequests).toHaveLength(1);
      expect(mapiRequests[0].headers.has("traceparent")).toBe(false);
    });
  });

  describe("debug mode", () => {
    it("should print the payload to stderr instead of sending it", async () => {
      preconditions.consentGiven();
      preconditions.envSet("STORYBLOK_TELEMETRY_DEBUG");
      const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

      await run(["components", "push"]);

      expect(received).toHaveLength(0);
      const output = stderr.mock.calls.map(([chunk]) => String(chunk)).join("");
      expect(output).toContain(`POST ${ENDPOINT}/v1/traces`);
      expect(output).toContain(`POST ${ENDPOINT}/v1/metrics`);
      expect(output).toContain("storyblok.cli.command");
    });

    it("should stay off when set to false", async () => {
      preconditions.consentGiven();
      preconditions.envSet("STORYBLOK_TELEMETRY_DEBUG", "false");

      await run(["components", "push"]);

      expect(received).toHaveLength(2);
    });
  });

  describe("delivery", () => {
    it("should hand the payload to a detached process so the run can exit", async () => {
      preconditions.consentGiven();
      preconditions.ingestionHangs();
      const program = createProgram();
      await program.parseAsync(["components", "push"], { from: "user" });
      const started = Date.now();

      await sendTelemetry({ program, startTime: START_TIME, exitCode: 0 });

      expect(Date.now() - started).toBeLessThan(100);
      expect(spawn).toHaveBeenCalledWith(
        process.execPath,
        [expect.stringMatching(/telemetry-sender\.mjs$/)],
        expect.objectContaining({ detached: true }),
      );
    });

    it("should not fail the run when the detached process can't start", async () => {
      preconditions.consentGiven();
      preconditions.senderCannotStart();

      await expect(run(["components", "push"])).resolves.toBeUndefined();
    });

    it("should give up on an unresponsive endpoint after the timeout", async () => {
      preconditions.consentGiven();
      preconditions.ingestionHangs();
      const started = Date.now();

      await run(["components", "push"]);

      expect(Date.now() - started).toBeLessThan(1000);
    });

    it("should swallow network errors", async () => {
      preconditions.consentGiven();
      preconditions.ingestionFails();

      await expect(run(["components", "push"])).resolves.toBeUndefined();
    });
  });
});
