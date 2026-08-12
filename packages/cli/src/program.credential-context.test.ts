// Integration coverage for credential-context wiring in the shared preAction hook.
// The matcher cannot be verified in isolation: only a real command run proves the
// context is populated before the action executes.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCredentialContext, resetCredentialContext } from "./utils/error/credential-context";

vi.mock("./api", () => ({
  getMapiClient: vi.fn(),
}));

describe("program preAction credential context", () => {
  beforeEach(() => {
    resetCredentialContext();
    vi.clearAllMocks();
  });

  it("should expose the PAT session to the error layer", async () => {
    // Deliberately no vi.resetModules() here: resetting the module registry would
    // give program.ts a fresh instance of ./utils/error/credential-context, distinct
    // from the one statically imported above, so setCredentialContext and
    // getCredentialContext would read and write different singletons.
    const { getProgram } = await import("./program");
    const program = getProgram();
    program
      .command("context-probe-pat")
      .option("-s, --space <space>", "space ID")
      .action(() => {});

    await program.parseAsync(["node", "test", "context-probe-pat", "--space", "4242"]);

    expect(getCredentialContext()).toMatchObject({ kind: "pat", space: "4242" });
  });
});
