import React, { createRef } from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import type { BlockContent } from "@storyblok/react";
import RefChecker from "./ref-checker";

// ─── Mock @storyblok/react ────────────────────────────────────────────────────

vi.mock("@storyblok/react", () => ({
  storyblokEditable: vi.fn(() => ({ "data-blok-uid": "test-uid" })),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const block = { component: "ref-checker", _uid: "uid-1" } as BlockContent;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("RefChecker", () => {
  it("forwards the ref to the root div", () => {
    const ref = createRef<HTMLDivElement>();
    render(<RefChecker block={block} ref={ref} />);
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe("DIV");
  });

  it("attaches data-test attribute to the root div", () => {
    const ref = createRef<HTMLDivElement>();
    const { container } = render(<RefChecker block={block} ref={ref} />);
    const el = container.querySelector('[data-test="ref-checker"]');
    expect(el).toBe(ref.current);
  });

  it("renders the label text", () => {
    const { container } = render(<RefChecker block={block} ref={createRef()} />);
    const el = container.querySelector('[data-test="ref-checker"]');
    expect(el).toHaveTextContent("Should have a passed ref");
  });
});
