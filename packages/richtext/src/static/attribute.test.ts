import { describe, expect, it } from "vitest";
import { EXCLUDED_ATTRS, processAttrs } from "./attribute";

describe("processAttrs", () => {
  it("maps style properties correctly", () => {
    expect(
      processAttrs("paragraph", {
        textAlign: "center",
      }),
    ).toEqual({
      style: {
        textAlign: "center",
      },
    });
  });

  it("skips null and undefined values", () => {
    expect(
      processAttrs("paragraph", {
        textAlign: null,
        colspan: undefined,
      }),
    ).toEqual({});
  });

  it("skips empty string values (important fix)", () => {
    expect(
      processAttrs("paragraph", {
        textAlign: "",
      }),
    ).toEqual({});
  });

  it("keeps 0 as valid value", () => {
    expect(
      processAttrs("tableCell", {
        colwidth: 0,
      }),
    ).toEqual({
      style: {
        width: 0,
      },
    });
  });

  it("keeps false as a value in non-style attributes", () => {
    expect(
      processAttrs("paragraph", {
        test: false,
      }),
    ).toEqual({
      test: false,
    });
  });
  it("excludes all the attributes added in EXCLUDED_ATTRS", () => {
    expect(
      processAttrs(
        "paragraph",
        Array.from(EXCLUDED_ATTRS).reduce(
          (acc, attr) => {
            acc[attr] = "test";
            return acc;
          },
          {} as Record<string, string>,
        ),
      ),
    ).toEqual({});
  });

  it("stringifies object values", () => {
    expect(
      processAttrs("paragraph", {
        meta: { a: 1 },
      }),
    ).toEqual({
      meta: '{"a":1}',
    });
  });

  it("applies default attribute mapping", () => {
    expect(
      processAttrs("heading", {
        level: 2,
        textAlign: "right",
      }),
    ).toEqual({
      style: {
        textAlign: "right",
      },
    });
  });

  it("allows extendAttrMap to override defaults", () => {
    expect(
      processAttrs(
        "paragraph",
        {
          test: 1,
        },
        {
          test: "data-test",
        },
      ),
    ).toEqual({
      "data-test": 1,
    });
  });

  it("applies styleMap for paragraph", () => {
    expect(
      processAttrs("paragraph", {
        textAlign: "right",
      }),
    ).toEqual({
      style: {
        textAlign: "right",
      },
    });
  });

  it("handles array values with px conversion", () => {
    expect(
      processAttrs("tableCell", {
        colwidth: [200],
      }),
    ).toEqual({
      style: {
        width: "200px",
      },
    });
  });
  it("handles story link", () => {
    expect(
      processAttrs("link", {
        linktype: "story",
        href: "/story/123",
        anchor: "section-1",
      }),
    ).toEqual({
      href: "/story/123#section-1",
    });
  });
  it("handles story link with null href", () => {
    expect(
      processAttrs("link", {
        linktype: "story",
        href: null,
        anchor: "section-1",
      }),
    ).toEqual({
      href: "#section-1",
    });
  });
});
