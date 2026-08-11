import { describe, expect, it } from "vitest";

import type { Component } from "../../../../types";
import { FIXTURE_COMPONENTS } from "./__fixtures__/components";
import { renderSchemaTypes, toRelativeImport } from "./render";
import { serializeBlockDefinition } from "./serialize";

/**
 * Serializes the fixture components the way `generateSchemaTypes` does, so the
 * committed fixture stays a faithful sample of real output: sorted by name, with
 * every fixture component registered as a known block so `allow` entries survive.
 */
function serializeFixtureBlocks() {
  const components: Component[] = FIXTURE_COMPONENTS;
  const knownBlockNames = new Set(components.map((component) => component.name));
  return [...components]
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map((component) =>
      serializeBlockDefinition(component, { displayPathByUuid: new Map(), knownBlockNames }),
    );
}

/**
 * The committed fixture is what `emitted-types.test-d.ts` typechecks. If the
 * renderer changes, this test fails and the fixture must be regenerated (`-u`),
 * which re-runs the type-level assertions against the new output. Without this
 * test the fixture could silently rot into a file the CLI no longer produces.
 */
describe("emitted type fixture", () => {
  it("matches what the renderer currently produces", async () => {
    const rendered = renderSchemaTypes({
      blocks: serializeFixtureBlocks(),
      fieldPlugins: { kind: "none" },
      space: "295018",
    });

    await expect(rendered).toMatchFileSnapshot("./__fixtures__/expected-types.d.ts");
  });

  /**
   * Same components, but with `__fixtures__/plugins.ts` registered as the
   * `colorpicker` field plugin. `emitted-types.test-d.ts` typechecks this
   * fixture to prove `custom` fields resolve through `Story`/`StoryMapi`, not
   * just through `Block<TName>`, see the "emitted `Story`" describe block.
   */
  it("matches what the renderer produces with field plugins registered", async () => {
    const rendered = renderSchemaTypes({
      blocks: serializeFixtureBlocks(),
      fieldPlugins: { kind: "record", modulePath: "/abs/plugins.ts", fieldTypes: ["colorpicker"] },
      // Derived rather than hardcoded, so the fixture tracks the real specifier.
      fieldPluginsImportPath: toRelativeImport("/abs", "/abs/plugins.ts"),
      space: "295018",
    });

    await expect(rendered).toMatchFileSnapshot("./__fixtures__/expected-types-with-plugins.d.ts");
  });
});
