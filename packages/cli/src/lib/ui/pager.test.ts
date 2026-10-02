import * as childProcess from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "./pager";

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return { ...actual, spawn: vi.fn(actual.spawn) };
});

/**
 * `isTTY` and `rows` are plain data properties, absent entirely when stdout is
 * not a terminal, so they are set and restored rather than spied on.
 */
function setStdout(properties: { isTTY?: boolean; rows?: number }): () => void {
  const originals = Object.keys(properties).map(
    (key) => [key, Object.getOwnPropertyDescriptor(process.stdout, key)] as const,
  );
  for (const [key, value] of Object.entries(properties)) {
    Object.defineProperty(process.stdout, key, { value, configurable: true });
  }
  return () => {
    for (const [key, original] of originals) {
      if (original) {
        Object.defineProperty(process.stdout, key, original);
      } else {
        delete (process.stdout as unknown as Record<string, unknown>)[key];
      }
    }
  };
}

const tallText = Array.from({ length: 50 }, (_, index) => `line ${index}`).join("\n");

describe("page", () => {
  let restore: () => void = () => {};
  let written: string[];

  beforeEach(() => {
    written = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      written.push(String(chunk));
      return true;
    });
  });

  afterEach(() => {
    restore();
    vi.restoreAllMocks();
  });

  it("should print directly when the text fits the terminal", async () => {
    restore = setStdout({ isTTY: true, rows: 100 });

    await page("short");

    expect(written).toEqual(["short\n"]);
  });

  it("should print directly when stdout is not a terminal", async () => {
    restore = setStdout({ isTTY: false, rows: 10 });

    await page(tallText);

    expect(written).toEqual([`${tallText}\n`]);
  });

  // Most Windows machines have no `less`: the results must still be shown.
  it("should fall back to printing when the pager cannot be started", async () => {
    restore = setStdout({ isTTY: true, rows: 10 });
    const { spawn } = await vi.importActual<typeof childProcess>("node:child_process");
    vi.mocked(childProcess.spawn).mockImplementationOnce((_command, args, options) =>
      spawn("storyblok-no-such-pager", args, options),
    );

    await page(tallText);

    expect(written).toEqual([`${tallText}\n`]);
  });
});
