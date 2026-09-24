import { describe, expect, it } from "vitest";
import { preserveElementAttributes } from "../src/live-preview/handleStoryblokMessage";

// This package's unit tests run in the "node" environment (no DOM), so we fake
// just enough of the `Element` interface that `preserveElementAttributes` needs.
function createElement(attrs: Record<string, string>): Element {
  const store = new Map(Object.entries(attrs));
  const attributes = {
    getNamedItem: (name: string) => (store.has(name) ? { value: store.get(name)! } : null),
    [Symbol.iterator]: function* () {
      for (const [name, value] of store) {
        yield { name, value };
      }
    },
  };

  return {
    attributes,
    hasAttribute: (name: string) => store.has(name),
    getAttribute: (name: string) => store.get(name) ?? null,
    setAttribute: (name: string, value: string) => {
      store.set(name, value);
    },
  } as unknown as Element;
}

describe("preserveElementAttributes", () => {
  it("copies attributes when both elements share the same data-blok-uid", () => {
    const fromEl = createElement({ "data-blok-uid": "123", open: "" });
    const toEl = createElement({ "data-blok-uid": "123" });

    preserveElementAttributes(fromEl, toEl);

    expect(toEl.hasAttribute("open")).toBe(true);
  });

  it("does not copy attributes when data-blok-uid differs", () => {
    const fromEl = createElement({ "data-blok-uid": "123", open: "" });
    const toEl = createElement({ "data-blok-uid": "456" });

    preserveElementAttributes(fromEl, toEl);

    expect(toEl.hasAttribute("open")).toBe(false);
  });

  it("does not copy attributes when neither element has a data-blok-uid", () => {
    // e.g. a plain child element below the nearest storyblokEditable wrapper,
    // whose class changes with CMS-driven props like `accentClass`/`textCentered`.
    const fromEl = createElement({ class: "accent-red text-center" });
    const toEl = createElement({ class: "accent-blue" });

    preserveElementAttributes(fromEl, toEl);

    expect(toEl.getAttribute("class")).toBe("accent-blue");
  });

  it("leaves the new element's own attributes untouched when not present on the old element", () => {
    const fromEl = createElement({ "data-blok-uid": "123" });
    const toEl = createElement({ "data-blok-uid": "123", class: "accent-blue" });

    preserveElementAttributes(fromEl, toEl);

    expect(toEl.getAttribute("class")).toBe("accent-blue");
  });
});
