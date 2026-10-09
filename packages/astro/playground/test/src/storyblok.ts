import { createApiClient } from "@storyblok/api-client";
import { defineStoryblokBlocks } from "@storyblok/astro";
import Page from "./blocks/Page.astro";
import Feature from "./blocks/subfolder/Feature.astro";
import Grid from "./blocks/Grid.astro";
import Teaser from "./blocks/Teaser.astro";
import ReactCounter from "./blocks/ReactCounter.astro";
import FeaturedArticles from "./blocks/FeaturedArticles.astro";
import RichText from "./blocks/RichText.astro";
import EmbeddedBlok from "./blocks/EmbeddedBlok.astro";
import CustomFallback from "./blocks/CustomFallback.astro";

export const client = createApiClient({
  accessToken: "hjfIuqpPLxaJIYlgCAylKgtt",
});

export const { StoryblokBlock } = defineStoryblokBlocks({
  components: {
    page: Page,
    feature: Feature,
    grid: Grid,
    teaser: Teaser,
    react_counter: ReactCounter,
    "featured-articles": FeaturedArticles,
    richtext: RichText,
    embedded_blok: EmbeddedBlok,
  },
  fallback: CustomFallback,
});
