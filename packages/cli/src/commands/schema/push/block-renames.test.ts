import { describe, expect, it } from "vitest";

import { withRenamedBlocks } from "./block-renames";

describe("withRenamedBlocks", () => {
  it("should name a renamed block, and the fields that restrict or filter by it, by its new name", () => {
    const components = [
      { name: "promo", schema: { title: { type: "text" } } },
      {
        name: "page",
        schema: {
          body: { type: "bloks", component_whitelist: ["promo", "card"] },
          footer: { type: "bloks", component_denylist: ["promo"] },
          related: { type: "multilink", filter_content_type: "promo" },
          other: { type: "multilink", filter_content_type: "article" },
        },
      },
    ];

    expect(withRenamedBlocks(components, [{ from: "promo", to: "teaser" }])).toEqual([
      { name: "teaser", schema: { title: { type: "text" } } },
      {
        name: "page",
        schema: {
          body: { type: "bloks", component_whitelist: ["teaser", "card"] },
          footer: { type: "bloks", component_denylist: ["teaser"] },
          related: { type: "multilink", filter_content_type: "teaser" },
          other: { type: "multilink", filter_content_type: "article" },
        },
      },
    ]);
  });

  it("should leave the components as they are without renames", () => {
    const components = [{ name: "promo", schema: { title: { type: "text" } } }];

    expect(withRenamedBlocks(components, [])).toEqual(components);
  });
});
