import { createApiClient } from "@storyblok/api-client";
import { defineStoryblokBlocks } from "@storyblok/astro";
import Page from "./blocks/Page.astro";
import Feature from "./blocks/Feature.astro";
import Grid from "./blocks/Grid.astro";
import Teaser from "./blocks/Teaser.astro";
import FeaturedArticles from "./blocks/FeaturedArticles.astro";
import LoadCounter from "./blocks/LoadCounter.astro";
import ReactCounter from "./blocks/ReactCounter.astro";
import TestFallback from "./components/TestFallback.astro";

export const client = createApiClient({
  accessToken: process.env.STORYBLOK_ACCESS_TOKEN ?? "OsvNv534kS2nivAAj1EPVgtt",
  inlineRelations: true,
});

export const { StoryblokBlock } = defineStoryblokBlocks(() => ({
  components: {
    page: Page,
    feature: Feature,
    grid: Grid,
    teaser: Teaser,
    "featured-articles": FeaturedArticles,
    load_counter: LoadCounter,
    react_counter: ReactCounter,
  },
  fallback: TestFallback,
}));
