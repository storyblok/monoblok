import { createRequire } from "node:module";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

/**
 * The built `dist/` output declares the same generic types as `src/`, but under
 * a different module path, so TS treats them as structurally-identical yet
 * nominally-unrelated types. Typing this loosely avoids that false mismatch —
 * this test only cares that a real request round-trips through the built
 * artifact, not the exact response shape.
 */
type BuiltManagementApiClientModule = {
  createManagementApiClient: (config: {
    personalAccessToken: string;
    spaceId: number;
    region?: string;
    rateLimit?: false;
  }) => {
    spaces: {
      get: () => Promise<{ data?: { space: { id: number } }; error?: unknown }>;
    };
  };
};

/**
 * Regression test for the `ky` ESM/CJS interop bug: requiring the built CJS
 * entry point threw `TypeError: kyInstance is not a function`, uncaught,
 * because tsdown's CJS output double-wraps a `require`d external ESM default
 * export for a `"type": "module"` package
 * (https://github.com/rolldown/rolldown/issues/10308), turning `ky`'s default
 * export into the whole module namespace instead of the callable function.
 * Unlike `@storyblok/api-client`, this package's generated `request()` has no
 * outer `try/catch`, so the `TypeError` propagated as a raw rejection instead
 * of a `ClientError`. The fix (`deps.alwaysBundle: ["ky"]` in
 * `vite.config.ts`) bundles `ky` into the output instead of leaving it
 * external, sidestepping that broken require-of-ESM interop path.
 * Source-level tests (e.g. `resources/spaces.test.ts`) import from `../index`
 * directly, so they never exercise the built artifact and would not have
 * caught this. These tests require the actual `dist/` output, which nx
 * guarantees exists by running `test` after `build` (see `nx.json`'s
 * `targetDefaults`).
 */
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const spaceHandler = () =>
  http.get("https://mapi.storyblok.com/v1/spaces/:space_id", () =>
    HttpResponse.json({ space: { id: 123, name: "Space" } }),
  );

describe("built dist artifacts", () => {
  it("requires the CJS build and performs a real request through ky", async () => {
    const require = createRequire(import.meta.url);
    const {
      createManagementApiClient,
    }: BuiltManagementApiClientModule = require("../dist/index.cjs");

    server.use(spaceHandler());

    const client = createManagementApiClient({
      personalAccessToken: "test-token",
      spaceId: 123,
      region: "eu",
      rateLimit: false,
    });
    const result = await client.spaces.get();

    expect(result.error).toBeUndefined();
    expect(result.data?.space.id).toBe(123);
  });

  it("imports the ESM build and performs a real request through ky", async () => {
    const importedModule: unknown = await import("../dist/index.mjs");
    const { createManagementApiClient } = importedModule as BuiltManagementApiClientModule;

    server.use(spaceHandler());

    const client = createManagementApiClient({
      personalAccessToken: "test-token",
      spaceId: 123,
      region: "eu",
      rateLimit: false,
    });
    const result = await client.spaces.get();

    expect(result.error).toBeUndefined();
    expect(result.data?.space.id).toBe(123);
  });
});
