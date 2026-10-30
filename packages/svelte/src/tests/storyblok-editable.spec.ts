import { describe, expect, it, vi } from "vitest";
import { storyblokEditable } from "../lib/storyblok-editable";

describe("storyblokEditable", () => {
  it("should return the editable attributes for a block", () => {
    const block = { _editable: '<!--#storyblok#{"id":"story-1","uid":"uid-1"}-->' };

    expect(storyblokEditable(block)).toMatchObject({ "data-blok-uid": "story-1-uid-1" });
  });

  it("should warn when used as a Svelte action on a DOM node", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Mimics a JavaScript caller using `use:storyblokEditable`, which
    // TypeScript would reject.
    const result = Reflect.apply(storyblokEditable, undefined, [document.createElement("section")]);

    expect(result).toEqual({});
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining("no longer a Svelte action"));
    consoleWarn.mockRestore();
  });
});
