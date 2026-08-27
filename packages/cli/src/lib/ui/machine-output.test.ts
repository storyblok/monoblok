import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UI } from "./ui";

/**
 * The EPIPE guard and the "stdout has closed" flag are module state, installed
 * once per process. Re-importing per test is what gives each one a stdout that
 * has not been closed yet.
 */
async function freshModule() {
  vi.resetModules();
  return import("./machine-output");
}

const epipe = (): NodeJS.ErrnoException =>
  Object.assign(new Error("write EPIPE"), { code: "EPIPE" });

/**
 * `process.stdout.isTTY` is a plain data property, absent entirely when stdout
 * is not a terminal, so it is set and restored rather than spied on.
 */
function withStdoutTTY(value: boolean, run: () => void) {
  const original = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
  Object.defineProperty(process.stdout, "isTTY", { value, configurable: true });
  try {
    run();
  } finally {
    if (original) {
      Object.defineProperty(process.stdout, "isTTY", original);
    } else {
      delete (process.stdout as { isTTY?: boolean }).isTTY;
    }
  }
}

/** Only the two members `createJsonlOutput` reaches for. */
const fakeUI = () =>
  ({
    writeMachineOutput: vi.fn(),
    suppressProgress: vi.fn(),
  }) as unknown as UI & { writeMachineOutput: ReturnType<typeof vi.fn> };

describe("createJsonlOutput", () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Regression: results used to be held back until the run ended whenever
  // stderr was a terminal, which left `… | head -5` waiting for a whole scope,
  // kept every matched story in memory, and made the early exit unreachable in
  // exactly the case people try first.
  it("should write each line as it is pushed", async () => {
    const { createJsonlOutput } = await freshModule();
    const lines: string[] = [];
    const output = createJsonlOutput({ write: (line) => lines.push(line), ui: fakeUI() });

    output.push({ id: 1 });
    expect(lines).toEqual(['{"id":1}']);

    output.push({ id: 2 });
    expect(lines).toEqual(['{"id":1}', '{"id":2}']);
  });

  it("should write one JSON document per line", async () => {
    const { createJsonlOutput } = await freshModule();
    const lines: string[] = [];
    const output = createJsonlOutput({ write: (line) => lines.push(line), ui: fakeUI() });

    output.push({ id: 1, nested: { a: [1, 2] } });

    expect(lines).toEqual(['{"id":1,"nested":{"a":[1,2]}}']);
    expect(lines[0]).not.toContain("\n");
  });

  it("should route to the UI when no writer is given", async () => {
    const { createJsonlOutput } = await freshModule();
    const ui = fakeUI();
    createJsonlOutput({ ui }).push({ id: 1 });

    expect(ui.writeMachineOutput).toHaveBeenCalledWith('{"id":1}');
  });

  // Data on stdout and bars on stderr reaching one terminal overwrite each
  // other, and unlike the piped case this one is detectable rather than guessed.
  it("should drop progress rendering when stdout is a terminal", async () => {
    const { createJsonlOutput } = await freshModule();
    const ui = fakeUI();

    withStdoutTTY(true, () => createJsonlOutput({ write: () => {}, ui }));

    expect(ui.suppressProgress).toHaveBeenCalled();
  });

  it("should keep progress rendering when stdout is redirected", async () => {
    const { createJsonlOutput } = await freshModule();
    const ui = fakeUI();

    withStdoutTTY(false, () => createJsonlOutput({ write: () => {}, ui }));

    expect(ui.suppressProgress).not.toHaveBeenCalled();
  });

  // Regression: the run used to keep listing and fetching a whole space for a
  // reader that had already exited, so `find | head -3` ran to completion.
  it("should abort its signal when the downstream reader closes the pipe", async () => {
    const { createJsonlOutput, isDownstreamClosed } = await freshModule();
    const output = createJsonlOutput({ write: () => {}, ui: fakeUI() });

    expect(output.closed).toBe(false);
    expect(output.signal.aborted).toBe(false);

    process.stdout.emit("error", epipe());

    expect(output.closed).toBe(true);
    expect(output.signal.aborted).toBe(true);
    expect(isDownstreamClosed(output.signal.reason)).toBe(true);
  });

  it("should stop writing once the downstream reader is gone", async () => {
    const { createJsonlOutput } = await freshModule();
    const lines: string[] = [];
    const output = createJsonlOutput({ write: (line) => lines.push(line), ui: fakeUI() });

    output.push({ id: 1 });
    process.stdout.emit("error", epipe());
    output.push({ id: 2 });

    expect(lines).toEqual(['{"id":1}']);
  });

  it("should stop watching the pipe once closed", async () => {
    const { createJsonlOutput } = await freshModule();
    const output = createJsonlOutput({ write: () => {}, ui: fakeUI() });

    output.close();
    process.stdout.emit("error", epipe());

    expect(output.closed).toBe(false);
  });
});

describe("isDownstreamClosed", () => {
  it("should recognise its own abort reason", async () => {
    const { DownstreamClosedError, isDownstreamClosed } = await freshModule();
    expect(isDownstreamClosed(new DownstreamClosedError())).toBe(true);
  });

  // `stream.pipeline()` rejects with its own AbortError and moves the reason we
  // gave it onto `cause`, so the type alone does not identify it.
  it("should recognise the AbortError a pipeline wraps it in", async () => {
    const { DownstreamClosedError, isDownstreamClosed } = await freshModule();
    const aborted = Object.assign(new Error("The operation was aborted"), {
      name: "AbortError",
      cause: new DownstreamClosedError(),
    });
    expect(isDownstreamClosed(aborted)).toBe(true);
  });

  it("should not mistake an unrelated failure for a closed pipe", async () => {
    const { isDownstreamClosed } = await freshModule();
    expect(isDownstreamClosed(new Error("network down"))).toBe(false);
    expect(isDownstreamClosed(Object.assign(new Error("aborted"), { name: "AbortError" }))).toBe(
      false,
    );
  });
});
