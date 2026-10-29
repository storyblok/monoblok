import { createApiClient } from "@storyblok/api-client";
import { defineStoryblokBlocks } from "@storyblok/svelte";
import Teaser from "./Teaser.svelte";
import Page from "./Page.svelte";
import Feature from "./Feature.svelte";
import Grid from "./Grid.svelte";

export const client = createApiClient({
  accessToken: "OurklwV5XsDJTIE1NJaD2wtt",
});

export const { StoryblokBlock } = defineStoryblokBlocks(() => ({
  components: {
    teaser: Teaser,
    page: Page,
    feature: Feature,
    grid: Grid,
  },
}));
