import { createRequire } from "node:module";
import { resolve } from "pathe";
import { afterAll, beforeAll, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { resolveCjsEntry } from "../../../tools/cjs/resolve-cjs-entry.ts";
import { warnsOnCjsEntry } from "../../../tools/cjs/warn-on-cjs-entry.ts";

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
const cjsEntry = resolveCjsEntry(pkgRoot);

it("should warn that the CJS build is deprecated", () => {
  expect(warnsOnCjsEntry(pkgRoot, cjsEntry)).toBe(true);
});

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
