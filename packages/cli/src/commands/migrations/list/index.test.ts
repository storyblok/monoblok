import { beforeEach, describe, expect, it, vi } from "vitest";
import { vol } from "memfs";

import "../index";
import { migrationsCommand } from "../command";
import { DEFAULT_SPACE } from "../../__tests__/helpers";
import { getUI } from "../../../lib/ui";
import { session } from "../../../session";
import { loggedOutSessionState } from "../../../../test/setup";
import { getProgram } from "../../../program";
import { resolveJournal } from "../content-journal";

const seedRun = (overrides: Partial<Parameters<ReturnType<typeof resolveJournal>["record"]>[0]>) =>
  resolveJournal({ path: undefined }).record(
    {
      id: "2026-09-23T10-00-00-000Z-0001-rename",
      space: DEFAULT_SPACE,
      migration: "0001-rename",
      appliedAt: "2026-09-23T10:00:00.000Z",
      stories: 3,
      blocks: 7,
      ...overrides,
    },
    [],
  );

const list = (...args: string[]): Promise<unknown> =>
  migrationsCommand.parseAsync(["node", "test", "list", ...args, "--space", DEFAULT_SPACE]);

describe("migrations list command", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vol.reset();
    getProgram().setOptionValueWithSource("path", undefined, "default");
  });

  it("should print a recorded run for the space", async () => {
    await seedRun({});
    const info = vi.spyOn(getUI(), "info");

    await list();

    expect(info.mock.calls.map(([message]) => message)).toEqual([
      expect.stringContaining("0001-rename"),
    ]);
  });

  it("should report when a space has no recorded runs", async () => {
    const info = vi.spyOn(getUI(), "info");

    await list();

    expect(info).toHaveBeenCalledWith("No migration runs recorded for this space.");
  });

  it("should not print runs recorded for a different space", async () => {
    await seedRun({ space: "99999" });
    const info = vi.spyOn(getUI(), "info");

    await list();

    expect(info).toHaveBeenCalledWith("No migration runs recorded for this space.");
  });

  it("should handle not logged in error", async () => {
    vi.mocked(session().initializeSession).mockImplementation(async () => {
      session().state = loggedOutSessionState();
    });
    const errorSpy = vi.spyOn(console, "error");

    await list();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("You are currently not logged in"),
    );
  });

  it("should handle missing space error", async () => {
    const errorSpy = vi.spyOn(console, "error");

    await migrationsCommand.parseAsync(["node", "test", "list"]);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Please provide the space as argument --space YOUR_SPACE_ID."),
    );
  });
});
