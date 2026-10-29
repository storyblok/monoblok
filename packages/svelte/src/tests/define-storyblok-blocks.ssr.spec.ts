// @vitest-environment node

import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import { defineStoryblokBlocks } from "../lib/define-storyblok-blocks";
import Teaser from "./blocks/Teaser.svelte";

describe("defineStoryblokBlocks SSR", () => {
  it("should render a registered block during SSR", () => {
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({
      components: { teaser: Teaser },
    }));

    const { body } = render(StoryblokBlock, {
      props: {
        block: { _uid: "1", component: "teaser", headline: "Server rendered" },
      },
    });

    expect(body).toContain("Server rendered");
  });
});
