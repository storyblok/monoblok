import { createApiClient } from "@storyblok/api-client";
import { defineStoryblokBlocks } from "@storyblok/svelte";
import Teaser from "./components/blocks/Teaser.svelte";
import Page from "./components/blocks/Page.svelte";
import Feature from "./components/blocks/Feature.svelte";
import Grid from "./components/blocks/Grid.svelte";
import FeaturedArticles from "./components/blocks/FeaturedArticles.svelte";

export const client = createApiClient({
  accessToken:
    import.meta.env.STORYBLOK_ACCESS_TOKEN ??
    import.meta.env.STORYBLOK_PREVIEW_TOKEN ??
    "OurklwV5XsDJTIE1NJaD2wtt",
  inlineRelations: true,
});

export const { StoryblokBlock } = defineStoryblokBlocks(() => ({
  components: {
    teaser: Teaser,
    page: Page,
    feature: Feature,
    grid: Grid,
    "featured-articles": FeaturedArticles,
  },
}));
