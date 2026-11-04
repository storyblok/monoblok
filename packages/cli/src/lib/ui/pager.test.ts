import * as childProcess from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultResolvedConfig } from "../config/defaults";
import { resetActiveConfig, setActiveConfig } from "../config/store";
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

/** `platform` is a read-only data property, so it is redefined and restored. */
function setPlatform(platform: NodeJS.Platform): () => void {
  const original = Object.getOwnPropertyDescriptor(process, "platform");
  Object.defineProperty(process, "platform", { value: platform, configurable: true });
  return () => {
    if (original) {
      Object.defineProperty(process, "platform", original);
    }
  };
}

const tallText = Array.from({ length: 50 }, (_, index) => `line ${index}`).join("\n");

describe("page", () => {
  let restore: () => void = () => {};
  let written: string[];

  beforeEach(() => {
    vi.mocked(childProcess.spawn).mockClear();
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
    resetActiveConfig();
  });

  /**
   * A terminal the pager would run in, with nothing turning it off. The
   * platform is pinned too, since paging is off on Windows, where CI also runs.
   */
  function onPageableTerminal(): void {
    const restoreStdout = setStdout({ isTTY: true });
    const restorePlatform = setPlatform("linux");
    restore = () => {
      restoreStdout();
      restorePlatform();
    };
    vi.stubEnv("TERM", "xterm-256color");
    vi.stubEnv("CI", "");
    vi.stubEnv("PAGER", "less");
  }

  /**
   * Swaps `less` for a Node process exiting with `exitCode`, so a test controls
   * how the pager exits on every platform: `true` and `false` are not on
   * Windows.
   */
  async function pagerExits(exitCode: number): Promise<void> {
    const { spawn } = await vi.importActual<typeof childProcess>("node:child_process");
    vi.mocked(childProcess.spawn).mockImplementationOnce((_command, _args, options) =>
      spawn(process.execPath, ["-e", `process.exit(${exitCode})`], options),
    );
  }

  // `less` stops at a warning there, and quitting it never shows the text.
  it("should print directly on a dumb terminal", async () => {
    restore = setStdout({ isTTY: true });
    vi.stubEnv("TERM", "dumb");

    await page(tallText);

    expect(written).toEqual([`${tallText}\n`]);
    expect(childProcess.spawn).not.toHaveBeenCalled();
  });

  // A terminal nobody reads (`script`, `docker run -t`, an agent) would
  // otherwise hang at the pager prompt.
  it.each([
    ["PAGER is cat", { PAGER: "cat" }],
    ["PAGER is empty", { PAGER: "" }],
    ["CI is set", { CI: "true" }],
  ])("should print directly when %s", async (_case, env) => {
    restore = setStdout({ isTTY: true });
    vi.stubEnv("TERM", "xterm-256color");
    vi.stubEnv("CI", "");
    vi.stubEnv("PAGER", "less");
    for (const [key, value] of Object.entries(env)) {
      vi.stubEnv(key, value);
    }

    await page(tallText);

    expect(written).toEqual([`${tallText}\n`]);
    expect(childProcess.spawn).not.toHaveBeenCalled();
  });

  // A bare `less` resolves against the current directory first on Windows.
  it("should print directly on Windows", async () => {
    onPageableTerminal();
    setPlatform("win32");

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
    onPageableTerminal();
    const { spawn } = await vi.importActual<typeof childProcess>("node:child_process");
    vi.mocked(childProcess.spawn).mockImplementationOnce((_command, args, options) =>
      spawn("storyblok-no-such-pager", args, options),
    );

    await page(tallText);

    expect(childProcess.spawn).toHaveBeenCalled();
    expect(written).toEqual([`${tallText}\n`]);
  });

  // A run nobody watches would otherwise hang at the pager prompt.
  it("should print directly when the UI is disabled", async () => {
    onPageableTerminal();
    const config = createDefaultResolvedConfig();
    config.ui.enabled = false;
    setActiveConfig(config);

    await page(tallText);

    expect(written).toEqual([`${tallText}\n`]);
    expect(childProcess.spawn).not.toHaveBeenCalled();
  });

  it.each(["false", "0"])("should still page when CI is %s", async (value) => {
    onPageableTerminal();
    vi.stubEnv("CI", value);
    await pagerExits(0);

    await page(tallText);

    expect(childProcess.spawn).toHaveBeenCalled();
    expect(written).toEqual([]);
  });

  // `LESS=--bogus-option`: the pager starts, complains, and shows nothing.
  it("should fall back to printing when the pager exits with an error", async () => {
    onPageableTerminal();
    await pagerExits(1);

    await page(tallText);

    expect(childProcess.spawn).toHaveBeenCalled();
    expect(written).toEqual([`${tallText}\n`]);
  });
});
