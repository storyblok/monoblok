import { describe, expect, it, vi } from "vitest";
import { assertOAuthRegionAuthorized, isSessionCommand } from "./region-guard";

const neverSwitches = vi.fn(async () => false);

describe("assertOAuthRegionAuthorized", () => {
  it("should allow a command that requests no region", async () => {
    await expect(
      assertOAuthRegionAuthorized(undefined, "eu", neverSwitches),
    ).resolves.toBeUndefined();
  });

  it("should allow a command that requests the region the session is already on", async () => {
    await expect(assertOAuthRegionAuthorized("eu", "eu", neverSwitches)).resolves.toBeUndefined();
  });

  it("should move the session to the requested region when that region has its own grant", async () => {
    const switchToRegion = vi.fn(async () => true);

    await expect(assertOAuthRegionAuthorized("us", "eu", switchToRegion)).resolves.toBeUndefined();
    expect(switchToRegion).toHaveBeenCalledWith("us");
  });

  it("should reject a requested region that no grant covers, naming both regions", async () => {
    await expect(assertOAuthRegionAuthorized("us", "eu", neverSwitches)).rejects.toThrow(
      /Your OAuth login is for region Europe \(eu\), but region United States \(us\) was requested/,
    );
  });

  it("should tell the user how to authorize the requested region", async () => {
    await expect(assertOAuthRegionAuthorized("us", "eu", neverSwitches)).rejects.toThrow(
      /storyblok login --oauth --region us/,
    );
  });
});

describe("isSessionCommand", () => {
  it.each(["login", "logout", "signup"])(
    "should exempt %s from the region check",
    (commandName) => {
      expect(isSessionCommand(commandName)).toBe(true);
    },
  );

  it("should not exempt a command that operates on a space", () => {
    expect(isSessionCommand("stories")).toBe(false);
  });
});
