import { describe, expect, it } from "vitest";
import { excludeComponentFromContext } from "./render-helpers";

describe("excludeComponentFromContext", () => {
  const Paragraph = () => null;
  const Heading = () => null;

  it("removes the override for the given type and keeps the rest of the context", () => {
    const context = { optimizeImage: true, components: { paragraph: Paragraph, heading: Heading } };

    expect(excludeComponentFromContext(context, "paragraph")).toEqual({
      optimizeImage: true,
      components: { paragraph: undefined, heading: Heading },
    });
  });

  it("does not mutate the given context", () => {
    const context = { components: { paragraph: Paragraph } };

    excludeComponentFromContext(context, "paragraph");

    expect(context.components.paragraph).toBe(Paragraph);
  });

  it("returns the same context when there is no override for the given type", () => {
    const context = { components: { heading: Heading } };

    expect(excludeComponentFromContext(context, "paragraph")).toBe(context);
    expect(excludeComponentFromContext({}, "paragraph")).toEqual({});
  });
});
