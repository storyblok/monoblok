import { createApiClient } from "@storyblok/api-client";
import { defineStoryblokBlocks } from "@storyblok/astro";
import Page from "./blocks/Page.astro";
import Feature from "./blocks/Feature.astro";
import Grid from "./blocks/Grid.astro";
import Teaser from "./blocks/Teaser.astro";
import ReactCounter from "./blocks/ReactCounter.astro";
import FeaturedArticles from "./blocks/FeaturedArticles.astro";
import TestFallback from "./components/TestFallback.astro";

export const client = createApiClient({
  accessToken: process.env.STORYBLOK_ACCESS_TOKEN ?? "OsvNv534kS2nivAAj1EPVgtt",
});

export const { StoryblokBlock } = defineStoryblokBlocks({
  components: {
    page: Page,
    feature: Feature,
    grid: Grid,
    teaser: Teaser,
    react_counter: ReactCounter,
    "featured-articles": FeaturedArticles,
  },
  fallback: TestFallback,
});
