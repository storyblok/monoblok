import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { vol } from "memfs";
import { confirm } from "@inquirer/prompts";
import { getStoryblokGlobalPath } from "../../utils/filesystem";
import { getConsentFilePath } from "../../lib/telemetry/consent";
import { TELEMETRY_SCHEMA_VERSION } from "../../lib/telemetry/config";
import { resetLogger } from "../../lib/logger/logger";
import { telemetryCommand } from "./";
import { logsCommand } from "../logs/command";
import "../logs";

vi.mock("@inquirer/prompts", () => ({ confirm: vi.fn() }));
vi.mock("std-env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("std-env")>()),
  detectProvider: () => ({ name: "", ci: false }),
}));

const INSTALL_ID = "3f0c1d9e-1111-4222-8333-944455556666";

function storedConsent() {
  const content = vol.toJSON()[getConsentFilePath()];
  return content ? JSON.parse(content) : undefined;
}

function output() {
  return [console.error, console.warn]
    .flatMap((fn) => vi.mocked(fn).mock.calls)
    .map((call) => call.join(" "))
    .join("\n");
}

function setIsTTY(value: boolean) {
  for (const stream of [process.stdin, process.stderr]) {
    Object.defineProperty(stream, "isTTY", { value, configurable: true, writable: true });
  }
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
  consentGivenForOlderSchema() {
    storeConsent({
      enabled: true,
      schemaVersion: TELEMETRY_SCHEMA_VERSION - 1,
      installId: INSTALL_ID,
    });
  },
  consentDeclinedForOlderSchema() {
    storeConsent({ enabled: false, schemaVersion: TELEMETRY_SCHEMA_VERSION - 1 });
  },
  consentCannotBeSaved() {
    vol.fromJSON({ [getStoryblokGlobalPath()]: "not a directory" });
  },
  doNotTrackSet() {
    vi.stubEnv("DO_NOT_TRACK", "1");
  },
  telemetryDisabledByEnv() {
    vi.stubEnv("STORYBLOK_TELEMETRY_DISABLED", "1");
  },
  runsInContainer() {
    vol.fromJSON({ "/.dockerenv": "" });
  },
  runsInAzurePipelines() {
    vi.stubEnv("TF_BUILD", "True");
  },
  runsInTerminal() {
    setIsTTY(true);
  },
  runsInCi() {
    vi.stubEnv("CI", "true");
  },
  userAnswers(answer: boolean) {
    vi.mocked(confirm).mockResolvedValue(answer);
  },
};

describe("telemetry command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLogger();
    vi.stubEnv("DO_NOT_TRACK", "");
    vi.stubEnv("STORYBLOK_TELEMETRY_DISABLED", "");
    vi.stubEnv("CI", "");
    vi.stubEnv("TF_BUILD", "");
    setIsTTY(false);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("should enable telemetry with a new install ID", async () => {
    await telemetryCommand.parseAsync(["node", "test", "enable"]);

    expect(storedConsent()).toMatchObject({
      enabled: true,
      schemaVersion: TELEMETRY_SCHEMA_VERSION,
      installId: expect.stringMatching(/^[\da-f-]{36}$/),
    });
  });

  it("should keep the install ID when enabling again", async () => {
    preconditions.consentGiven();

    await telemetryCommand.parseAsync(["node", "test", "enable"]);

    expect(storedConsent().installId).toBe(INSTALL_ID);
  });

  it("should warn that DO_NOT_TRACK still wins after enabling", async () => {
    preconditions.doNotTrackSet();

    await telemetryCommand.parseAsync(["node", "test", "enable"]);

    expect(output()).toContain("DO_NOT_TRACK is set and takes precedence");
  });

  it("should disable telemetry and forget the install ID", async () => {
    preconditions.consentGiven();

    await telemetryCommand.parseAsync(["node", "test", "disable"]);

    expect(storedConsent()).toMatchObject({ enabled: false });
    expect(storedConsent().installId).toBeUndefined();
  });

  it("should show the install ID when enabled", async () => {
    preconditions.consentGiven();

    await telemetryCommand.parseAsync(["node", "test", "status"]);

    expect(output()).toContain("Telemetry is enabled.");
    expect(output()).toContain(INSTALL_ID);
  });

  it("should explain that DO_NOT_TRACK disables telemetry", async () => {
    preconditions.consentGiven();
    preconditions.doNotTrackSet();

    await telemetryCommand.parseAsync(["node", "test", "status"]);

    expect(output()).toContain("disabled because DO_NOT_TRACK is set");
  });

  it("should explain that STORYBLOK_TELEMETRY_DISABLED disables telemetry", async () => {
    preconditions.consentGiven();
    preconditions.telemetryDisabledByEnv();

    await telemetryCommand.parseAsync(["node", "test", "status"]);

    expect(output()).toContain("disabled because STORYBLOK_TELEMETRY_DISABLED is set");
  });

  describe("consent prompt", () => {
    it("should ask on the first interactive run, with no preselected, and store the answer", async () => {
      preconditions.runsInTerminal();
      preconditions.userAnswers(true);

      await logsCommand.parseAsync(["node", "test", "list", "--space", "12345"]);

      expect(confirm).toHaveBeenCalledWith(
        expect.objectContaining({ default: false }),
        expect.anything(),
      );
      expect(storedConsent()).toMatchObject({ enabled: true });
    });

    it("should ask again after the collected data widened", async () => {
      preconditions.runsInTerminal();
      preconditions.consentGivenForOlderSchema();
      preconditions.userAnswers(true);

      await logsCommand.parseAsync(["node", "test", "list", "--space", "12345"]);

      expect(confirm).toHaveBeenCalled();
      expect(storedConsent()).toMatchObject({
        schemaVersion: TELEMETRY_SCHEMA_VERSION,
        installId: INSTALL_ID,
      });
    });

    it("should not ask again a user who declined before the collected data widened", async () => {
      preconditions.runsInTerminal();
      preconditions.consentDeclinedForOlderSchema();

      await logsCommand.parseAsync(["node", "test", "list", "--space", "12345"]);

      expect(confirm).not.toHaveBeenCalled();
    });

    it("should warn when the answer cannot be saved", async () => {
      preconditions.runsInTerminal();
      preconditions.consentCannotBeSaved();
      preconditions.userAnswers(true);

      await logsCommand.parseAsync(["node", "test", "list", "--space", "12345"]);

      expect(output()).toContain("Could not save your answer");
    });

    it("should store a declined answer", async () => {
      preconditions.runsInTerminal();
      preconditions.userAnswers(false);

      await logsCommand.parseAsync(["node", "test", "list", "--space", "12345"]);

      expect(storedConsent()).toMatchObject({ enabled: false });
    });

    it("should not ask again once answered", async () => {
      preconditions.runsInTerminal();
      preconditions.consentGiven();

      await logsCommand.parseAsync(["node", "test", "list", "--space", "12345"]);

      expect(confirm).not.toHaveBeenCalled();
    });

    it("should not ask without a terminal", async () => {
      await logsCommand.parseAsync(["node", "test", "list", "--space", "12345"]);

      expect(confirm).not.toHaveBeenCalled();
      expect(storedConsent()).toBeUndefined();
    });

    it("should not ask in CI", async () => {
      preconditions.runsInTerminal();
      preconditions.runsInCi();

      await logsCommand.parseAsync(["node", "test", "list", "--space", "12345"]);

      expect(confirm).not.toHaveBeenCalled();
    });

    it("should not ask in Azure Pipelines, which doesn't set CI", async () => {
      preconditions.runsInTerminal();
      preconditions.runsInAzurePipelines();

      await logsCommand.parseAsync(["node", "test", "list", "--space", "12345"]);

      expect(confirm).not.toHaveBeenCalled();
    });

    it("should not ask in a container, where every run would ask again", async () => {
      preconditions.runsInTerminal();
      preconditions.runsInContainer();

      await logsCommand.parseAsync(["node", "test", "list", "--space", "12345"]);

      expect(confirm).not.toHaveBeenCalled();
    });

    it("should not ask when DO_NOT_TRACK is set", async () => {
      preconditions.runsInTerminal();
      preconditions.doNotTrackSet();

      await logsCommand.parseAsync(["node", "test", "list", "--space", "12345"]);

      expect(confirm).not.toHaveBeenCalled();
    });

    it("should not ask before the telemetry command itself", async () => {
      preconditions.runsInTerminal();

      await telemetryCommand.parseAsync(["node", "test", "status"]);

      expect(confirm).not.toHaveBeenCalled();
    });
  });
});
