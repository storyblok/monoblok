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
type BuiltApiClientModule = {
  createApiClient: (config: { accessToken: string; region?: string }) => {
    stories: {
      get: (slug: string) => Promise<{ data?: { story: { id: number } }; error?: unknown }>;
    };
  };
};

/**
 * Regression test for the `ky` ESM/CJS interop bug: requiring the built CJS
 * entry point threw `TypeError: kyInstance is not a function` because tsdown's
 * CJS output double-wraps a `require`d external ESM default export for a
 * `"type": "module"` package (https://github.com/rolldown/rolldown/issues/10308),
 * turning `ky`'s default export into the whole module namespace instead of the
 * callable function. The fix (`deps.alwaysBundle: ["ky"]` in `vite.config.ts`)
 * bundles `ky` into the output instead of leaving it external, sidestepping
 * that broken require-of-ESM interop path. Source-level tests (e.g.
 * `client.test.ts`) import from `../src/client` directly, so they never
 * exercise the built artifact and would not have caught this. These tests
 * require the actual `dist/` output, which nx guarantees exists by running
 * `test` after `build` (see `nx.json`'s `targetDefaults`).
 */
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const storyHandler = () =>
  http.get("https://api.storyblok.com/v2/cdn/stories/home", () =>
    HttpResponse.json({ story: { id: 1, content: { component: "page" } }, cv: 1 }),
  );

describe("built dist artifacts", () => {
  it("requires the CJS build and performs a real request through ky", async () => {
    const require = createRequire(import.meta.url);
    const { createApiClient }: BuiltApiClientModule = require("../dist/index.cjs");

    server.use(storyHandler());

    const client = createApiClient({ accessToken: "test-token", region: "eu" });
    const result = await client.stories.get("home");

    expect(result.error).toBeUndefined();
    expect(result.data?.story.id).toBe(1);
  });

  it("imports the ESM build and performs a real request through ky", async () => {
    const importedModule: unknown = await import("../dist/index.mjs");
    const { createApiClient } = importedModule as BuiltApiClientModule;

    server.use(storyHandler());

    const client = createApiClient({ accessToken: "test-token", region: "eu" });
    const result = await client.stories.get("home");

    expect(result.error).toBeUndefined();
    expect(result.data?.story.id).toBe(1);
  });
});
