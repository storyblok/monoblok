import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { getMapiClient } from "../../api";
import { listLibrariesOrDegrade, resolveScopeBaseDir, type Scope } from "./scope";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  getMapiClient({ personalAccessToken: "valid-token", region: "eu" });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const preconditions = {
  forbidsLibraryDiscovery() {
    server.use(
      http.get("https://mapi.storyblok.com/v1/spaces/12345/shared_asset_folders", () =>
        HttpResponse.json(
          { error: "This endpoint does not support this token type" },
          { status: 403 },
        ),
      ),
    );
  },
  hasNoLibraries() {
    server.use(
      http.get("https://mapi.storyblok.com/v1/spaces/12345/shared_asset_folders", () =>
        HttpResponse.json({ shared_asset_folders: [] }),
      ),
    );
  },
};

describe("listLibrariesOrDegrade", () => {
  it("should return undefined when the credential cannot reach library discovery", async () => {
    preconditions.forbidsLibraryDiscovery();

    await expect(listLibrariesOrDegrade("12345")).resolves.toBeUndefined();
  });

  it("should return an empty list when the space simply has no libraries", async () => {
    preconditions.hasNoLibraries();

    await expect(listLibrariesOrDegrade("12345")).resolves.toEqual([]);
  });
});

describe("resolveScopeBaseDir", () => {
  it("returns the space subtree for a space scope", () => {
    const scope: Scope = { kind: "space", spaceId: "12345" };
    expect(resolveScopeBaseDir(scope, undefined).replace(/\\/g, "/")).toContain("assets/12345");
  });

  it("returns a subtree for a non-numeric source directory (e.g. seed staging)", () => {
    const scope: Scope = { kind: "space", spaceId: "qa-seed" };
    expect(resolveScopeBaseDir(scope, undefined).replace(/\\/g, "/")).toContain("assets/qa-seed");
  });

  it("returns the shared/<libraryId> subtree for a library scope", () => {
    const scope: Scope = { kind: "library", libraryId: 7 };
    expect(resolveScopeBaseDir(scope, undefined).replace(/\\/g, "/")).toContain("assets/shared/7");
  });
});
