import { describe, expect, it } from "vitest";
import { applyRelationVariants } from "./apply-relation-variants";

const resolution = { variants: new Map([["uuid-cta", "uuid-cta-urgent"]]) };
const variantStories = [{ uuid: "uuid-cta-urgent", content: { label: "Sign up today" } }];

describe("applyRelationVariants", () => {
  it("handles related stories that reference each other", () => {
    type Node = { uuid: string; content: { label: string; related?: Node } };
    const cta: Node = { uuid: "uuid-cta", content: { label: "Sign up" } };
    const footer: Node = { uuid: "uuid-footer", content: { label: "Footer", related: cta } };
    cta.content.related = footer;

    const [result] = applyRelationVariants([footer], variantStories, resolution);

    expect(result.content.related?.content).toEqual({ label: "Sign up today" });
  });

  it("does not share the variant content between the result and the variant stories", () => {
    const [result] = applyRelationVariants(
      [{ uuid: "uuid-cta", content: { label: "Sign up" } }],
      variantStories,
      resolution,
    );

    result.content.label = "Changed";
    expect(variantStories[0].content.label).toBe("Sign up today");
  });

  it("leaves objects that carry a mapped uuid but no content alone", () => {
    const link = { uuid: "uuid-cta", url: "/cta" };

    expect(applyRelationVariants({ link }, variantStories, resolution)).toEqual({ link });
  });
});
