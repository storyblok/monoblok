import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { $fetch, setup } from "@nuxt/test-utils/e2e";
import { describe, expect, it } from "vitest";

/**
 * Regression coverage for the playground pages the old Cypress suite drove.
 * That spec nested `it()` inside `it()`, which Cypress/Mocha never executes —
 * its assertions silently never ran. These are flattened so they actually do.
 *
 * These hit the real, shared Storyblok demo space content (see
 * `test/GUIDE.md`) rather than a mocked response, matching what the Cypress
 * suite did. That space is also used for manual live-editing QA, and its
 * editable text fields (e.g. the teaser headline) can drift between runs —
 * so assertions here check structure (blocks present, expected count), not
 * exact copy.
 */

const countOccurrences = (haystack: string, needle: string): number =>
  haystack.split(needle).length - 1;

const teaserText = (html: string): string | undefined =>
  html.match(/data-test="teaser"[^>]*>([^<]*)</)?.[1]?.trim();

const playgroundDir = fileURLToPath(new URL("../../playground", import.meta.url));

// In dev, `@nuxt/test-utils` builds into the playground's own `.nuxt` and
// deletes it on teardown if it created it, breaking a concurrent `nuxt build`.
// The directory cannot move: the playground `tsconfig.json` extends it.
mkdirSync(join(playgroundDir, ".nuxt"), { recursive: true });

describe("@storyblok/nuxt playground (Composition API)", async () => {
  await setup({
    rootDir: playgroundDir,
    dev: true,
  });

  it("renders the expected story when loading the components", async () => {
    const html = await $fetch<string>("/vue/test");
    expect(html).toContain('data-test="page"');
    expect(html).toContain('data-test="grid"');
    expect(countOccurrences(html, 'data-test="feature"')).toBe(2);
    expect(teaserText(html)).toBeTruthy();
  });

  it("renders the expected story when loading the components (long form)", async () => {
    const html = await $fetch<string>("/vue");
    expect(html).toContain('data-test="page"');
    expect(html).toContain('data-test="grid"');
    expect(countOccurrences(html, 'data-test="feature"')).toBe(3);
    expect(teaserText(html)).toBeTruthy();
  });
});
