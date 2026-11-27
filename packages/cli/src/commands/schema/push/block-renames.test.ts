import { describe, expect, it } from "vitest";

import { withRenamedBlocks } from "./block-renames";

describe("withRenamedBlocks", () => {
  it("should name a renamed block, and the allow lists that name it, by its new name", () => {
    const components = [
      { name: "promo", schema: { title: { type: "text" } } },
      {
        name: "page",
        schema: {
          body: { type: "bloks", component_whitelist: ["promo", "card"] },
        },
      },
    ];

    expect(withRenamedBlocks(components, [{ from: "promo", to: "teaser" }])).toEqual([
      { name: "teaser", schema: { title: { type: "text" } } },
      {
        name: "page",
        schema: {
          body: { type: "bloks", component_whitelist: ["teaser", "card"] },
        },
      },
    ]);
  });

  it("should leave the components as they are without renames", () => {
    const components = [{ name: "promo", schema: { title: { type: "text" } } }];

    expect(withRenamedBlocks(components, [])).toEqual(components);
  });
});
