import { fileURLToPath } from "node:url";
import { $fetch, setup } from "@nuxt/test-utils/e2e";
import { describe, expect, it } from "vitest";

/**
 * Regression coverage for the audit's "access token leaked to HTML" finding.
 * `enableServerClient: true` splits the token into the server-only runtime
 * config (see `src/module.ts`) specifically so it never reaches the client
 * bundle or the rendered page. This proves that split holds end to end,
 * against a real Nuxt build/render rather than just the module's own
 * runtimeConfig assignment.
 */
const FIXTURE_TOKEN = "fixture-secret-token";

describe("@storyblok/nuxt (enableServerClient: true)", async () => {
  await setup({
    rootDir: fileURLToPath(new URL("../fixtures/server-client", import.meta.url)),
    dev: true,
  });

  it("never includes the access token in the rendered page", async () => {
    const html = await $fetch<string>("/");
    expect(html).toContain("server-client fixture");
    expect(html).not.toContain(FIXTURE_TOKEN);
  });
});
