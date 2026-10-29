import { describe, expect, it, vi } from "vitest";
import { storyblokEditable } from "../lib/storyblok";
import type { StoryblokBlockData } from "../lib/types";

// Mock @storyblok/live-preview
vi.mock("@storyblok/live-preview", () => ({
  storyblokEditable: (blok: StoryblokBlockData) => {
    if (blok._editable) {
      return {
        "data-blok-c": "1234",
        "data-blok-uid": "123-456",
      };
    }
    return {};
  },
}));

describe("storyblok utilities", () => {
  describe("storyblokEditable", () => {
    it("should apply editable attributes to DOM node", () => {
      // Create a test DOM node
      const node = document.createElement("div");

      // Mock Storyblok block data
      const mockBlock: StoryblokBlockData = {
        _uid: "123-456",
        component: "test-component",
        _editable: '<!--#storyblok#{"name":"test-component"}-->',
      };

      // Apply storyblokEditable action
      storyblokEditable(node, mockBlock);

      // Assert that the correct attributes were applied
      expect(node.hasAttribute("data-blok-c")).toBe(true);
      expect(node.hasAttribute("data-blok-uid")).toBe(true);
      expect(node.classList.contains("storyblok__outline")).toBe(true);
    });

    it("should not apply attributes when _editable is not present", () => {
      // Create a test DOM node
      const node = document.createElement("div");

      // Mock Storyblok block data without _editable
      const mockBlock: StoryblokBlockData = {
        _uid: "123-456",
        component: "test-component",
      };

      // Apply storyblokEditable action
      storyblokEditable(node, mockBlock);

      // Assert that no attributes were applied
      expect(node.getAttribute("data-blok-c")).toBe(null);
      expect(node.getAttribute("data-blok-uid")).toBe(null);
      expect(node.classList.contains("storyblok__outline")).toBe(false);
    });
  });
});
