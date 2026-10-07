import * as childProcess from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "./pager";

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return { ...actual, spawn: vi.fn(actual.spawn) };
});

/**
 * `isTTY` is a plain data property, absent entirely when stdout is not a
 * terminal, so it is set and restored rather than spied on.
 */
function setStdout(properties: { isTTY?: boolean }): () => void {
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
    vi.unstubAllEnvs();
  });

  // `less` stops at a warning there, and quitting it never shows the text.
  it("should print directly on a dumb terminal", async () => {
    restore = setStdout({ isTTY: true });
    vi.stubEnv("TERM", "dumb");

    await page(tallText);

    expect(written).toEqual([`${tallText}\n`]);
    expect(childProcess.spawn).not.toHaveBeenCalled();
  });

  it("should print directly when stdout is not a terminal", async () => {
    restore = setStdout({ isTTY: false });

    await page(tallText);

    expect(written).toEqual([`${tallText}\n`]);
  });

  // Most Windows machines have no `less`: the results must still be shown.
  it("should fall back to printing when the pager cannot be started", async () => {
    restore = setStdout({ isTTY: true });
    vi.stubEnv("TERM", "xterm-256color");
    const { spawn } = await vi.importActual<typeof childProcess>("node:child_process");
    vi.mocked(childProcess.spawn).mockImplementationOnce((_command, args, options) =>
      spawn("storyblok-no-such-pager", args, options),
    );

    await page(tallText);

    expect(written).toEqual([`${tallText}\n`]);
  });
});
