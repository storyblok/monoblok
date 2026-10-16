import { Readable } from "node:stream";
import type { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UI } from "../ui";
import type { LineWriter } from "./output";

/**
 * The EPIPE guard and the "stdout has closed" flag are module state, installed
 * once per process. Re-importing per test is what gives each one a stdout that
 * has not been closed yet.
 */
async function freshModule() {
  vi.resetModules();
  return import("./output");
}

const epipe = (): NodeJS.ErrnoException =>
  Object.assign(new Error("write EPIPE"), { code: "EPIPE" });

/**
 * The `EPIPE` guard installs a listener on the real stdout, and `freshModule()`
 * makes every test install its own. Removing only what a test added keeps the
 * suite from tripping the max-listeners warning without touching the runner's
 * own listeners.
 */
let listenersBefore: unknown[] = [];
beforeEach(() => {
  listenersBefore = process.stdout.listeners("error");
});
afterEach(() => {
  for (const listener of process.stdout.listeners("error")) {
    if (!listenersBefore.includes(listener)) {
      process.stdout.off("error", listener as (...args: unknown[]) => void);
    }
  }
});

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
    // The real one reports whether stdout has room, and a sink waits on `false`.
    writeMachineOutput: vi.fn(() => true),
    suppressProgress: vi.fn(),
  }) as unknown as UI & { writeMachineOutput: ReturnType<typeof vi.fn> };

/** Writes one value through the sink and waits for it to be taken. */
const writeLine = (output: { sink: Writable }, value: unknown): Promise<void> =>
  new Promise((resolve) => {
    output.sink.write(value, () => resolve());
  });

describe("createJsonlOutput", () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Lines go out as produced, so a reader can act on the first one and leave early.
  it("should write each line as it is written to the sink", async () => {
    const { createJsonlOutput } = await freshModule();
    const lines: string[] = [];
    const output = createJsonlOutput({ write: (line) => lines.push(line), ui: fakeUI() });

    await writeLine(output, { id: 1 });
    expect(lines).toEqual(['{"id":1}']);

    await writeLine(output, { id: 2 });
    expect(lines).toEqual(['{"id":1}', '{"id":2}']);
  });

  it("should write one JSON document per line", async () => {
    const { createJsonlOutput } = await freshModule();
    const lines: string[] = [];
    const output = createJsonlOutput({ write: (line) => lines.push(line), ui: fakeUI() });

    await writeLine(output, { id: 1, nested: { a: [1, 2] } });

    expect(lines).toEqual(['{"id":1,"nested":{"a":[1,2]}}']);
    expect(lines[0]).not.toContain("\n");
  });

  it("should route to the UI when no writer is given", async () => {
    const { createJsonlOutput } = await freshModule();
    const ui = fakeUI();
    await writeLine(createJsonlOutput({ ui }), { id: 1 });

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

  // A reader that has exited stops the run instead of letting it walk the whole scope.
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

    await writeLine(output, { id: 1 });
    process.stdout.emit("error", epipe());
    await writeLine(output, { id: 2 });

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

describe("createJsonlOutput sink", () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should write one line per object it receives", async () => {
    const { createJsonlOutput } = await freshModule();
    const lines: string[] = [];
    const output = createJsonlOutput({ write: (line) => lines.push(line), ui: fakeUI() });

    await pipeline(Readable.from([{ id: 1 }, { id: 2 }]), output.sink);

    expect(lines).toEqual(['{"id":1}', '{"id":2}']);
  });

  // A reader slower than the run paces it, rather than having results buffered ahead of it.
  it("should hold the pipeline back until stdout drains", async () => {
    const { createJsonlOutput } = await freshModule();
    const lines: string[] = [];
    let releaseDrain: (() => void) | undefined;
    const writer: LineWriter = {
      // Full for the first line, ready again afterwards.
      write: (line) => {
        lines.push(line);
        return lines.length > 1;
      },
      waitForDrain: () =>
        new Promise<void>((resolve) => {
          releaseDrain = resolve;
        }),
    };
    const output = createJsonlOutput({ writer, ui: fakeUI() });

    const done = pipeline(Readable.from([{ id: 1 }, { id: 2 }]), output.sink);
    await vi.waitFor(() => expect(releaseDrain).toBeDefined());

    expect(lines).toEqual(['{"id":1}']);

    releaseDrain?.();
    await done;

    expect(lines).toEqual(['{"id":1}', '{"id":2}']);
  });

  // The two mechanisms meeting: stdout is backed up, so the sink is waiting for
  // a drain, and the reader then leaves — which means the drain never comes.
  it("should not hang when the reader leaves while stdout is backed up", async () => {
    const { createJsonlOutput } = await freshModule();
    const writeSpy = vi.spyOn(process.stdout, "write").mockReturnValue(false);
    // The default writer goes through the UI, which is what owns the EPIPE
    // guard; only the stdout call underneath it is stubbed out.
    const ui = fakeUI();
    ui.writeMachineOutput.mockImplementation((line: string) => process.stdout.write(`${line}\n`));
    const output = createJsonlOutput({ ui });

    const done = pipeline(Readable.from([{ id: 1 }, { id: 2 }]), output.sink);
    await vi.waitFor(() => expect(writeSpy).toHaveBeenCalled());
    process.stdout.emit("error", epipe());

    await expect(done).resolves.toBeUndefined();
    expect(output.closed).toBe(true);
  });
});

describe("createCollectingSink", () => {
  it("should hand every value to the consumer", async () => {
    const { createCollectingSink } = await freshModule();
    const received: number[] = [];

    await pipeline(
      Readable.from([1, 2, 3]),
      createCollectingSink<number>((n) => received.push(n)),
    );

    expect(received).toEqual([1, 2, 3]);
  });

  it("should fail the pipeline when the consumer throws", async () => {
    const { createCollectingSink } = await freshModule();

    await expect(
      pipeline(
        Readable.from([1]),
        createCollectingSink<number>(() => {
          throw new Error("no");
        }),
      ),
    ).rejects.toThrow("no");
  });
});
