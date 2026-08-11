import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { vol } from "memfs";

import { getMapiClient } from "../../../../api";
import { generateSchemaTypes } from "./index";

const SPACE = "295018";

const server = setupServer();

// `generateSchemaTypes` calls `fetchRemoteSchema`, which reads the MAPI
// singleton set up by the program's preAction hook. Calling the function
// directly (rather than through `command.parseAsync`) bypasses that hook, so
// initialize it here the same way: with a token and region.
getMapiClient({ personalAccessToken: "test-token", region: "eu" });

const preconditions = {
  /**
   * A `bloks` field whose `component_group_whitelist` names a group, and a
   * component that belongs to that same group. This is the one path no unit
   * test covers end to end: it needs the fetched folders and the fetched
   * components to line up through `generateSchemaTypes`.
   */
  hasComponentsWithAGroupWhitelist() {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${SPACE}/components`, () =>
        HttpResponse.json({
          components: [
            {
              id: 1,
              name: "hero",
              created_at: "",
              updated_at: "",
              is_root: false,
              is_nestable: true,
              component_group_uuid: "group-1",
              schema: { headline: { type: "text", required: true, pos: 0 } },
            },
            {
              id: 2,
              name: "page",
              created_at: "",
              updated_at: "",
              is_root: true,
              is_nestable: false,
              schema: { body: { type: "bloks", component_group_whitelist: ["group-1"], pos: 0 } },
            },
          ],
        }),
      ),
      http.get(`https://mapi.storyblok.com/v1/spaces/${SPACE}/component_groups`, () =>
        HttpResponse.json({
          component_groups: [{ id: 1, uuid: "group-1", name: "My Layout", parent_uuid: null }],
        }),
      ),
      http.get(`https://mapi.storyblok.com/v1/spaces/${SPACE}/datasources`, () =>
        HttpResponse.json({ datasources: [] }),
      ),
    );
  },
};

describe("generateSchemaTypes (integration)", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

  afterEach(() => {
    server.resetHandlers();
    vol.reset();
  });

  afterAll(() => server.close());

  it("should resolve a component group into a folder literal and a group whitelist into an allow list", async () => {
    preconditions.hasComponentsWithAGroupWhitelist();
    vol.fromJSON({ "/project/package.json": "{}" });

    const result = await generateSchemaTypes({
      space: SPACE,
      cwd: "/project",
      outputDir: "/project/.storyblok/types/295018",
      filename: "storyblok-schema",
    });

    expect(result.files).toHaveLength(1);
    const content = vol.readFileSync(result.files[0], "utf8") as string;

    // The component group resolves into a `folder` literal on the block that
    // belongs to it.
    expect(content).toContain("folder: 'My Layout';");
    // The field's `component_group_whitelist` resolves into an `allow` list
    // naming the same folder, proving the fetched folders and the fetched
    // components were joined correctly.
    expect(content).toContain("allow: [{ folder: 'My Layout' }]");
    // The shared surface is present: `Blocks` unions both definition types.
    expect(content).toContain("export type Blocks = HeroBlockDefinition | PageBlockDefinition;");

    expect(content).toMatchSnapshot();
  });
});
