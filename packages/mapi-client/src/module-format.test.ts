import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "pathe";
import { afterAll, beforeAll, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

// Regression test for https://github.com/storyblok/monoblok/issues/866:
// node-mode interop in the CJS build turned the `ky` default export into an object.
// Runs post-build (nx task graph ensures build → test order).

const server = setupServer(
  http.get("https://mapi.storyblok.com/v1/spaces/:space_id/stories", () =>
    HttpResponse.json({ stories: [] }),
  ),
);

beforeAll(() => server.listen());
afterAll(() => server.close());

const req = createRequire(import.meta.url);
const pkgRoot = resolve(__dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(pkgRoot, "package.json"), "utf8"));
const cjsEntry = resolve(pkgRoot, pkg.exports["."].require);

it("should perform requests when loaded with require()", async () => {
  const { createManagementApiClient } = req(cjsEntry);
  const client = createManagementApiClient({
    personalAccessToken: "x",
    spaceId: 42,
    rateLimit: false,
  });

  const { data, error } = await client.stories.list();

  expect(error).toBeUndefined();
  expect(data).toEqual({ stories: [] });
});
