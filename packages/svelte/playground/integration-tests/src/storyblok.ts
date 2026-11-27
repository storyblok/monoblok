import { defineStoryblokBlocks } from "@storyblok/svelte";
import Teaser from "./components/blocks/Teaser.svelte";
import Page from "./components/blocks/Page.svelte";
import Feature from "./components/blocks/Feature.svelte";
import Grid from "./components/blocks/Grid.svelte";
import FeaturedArticles from "./components/blocks/FeaturedArticles.svelte";

export const { StoryblokBlock } = defineStoryblokBlocks(() => ({
  components: {
    teaser: Teaser,
    page: Page,
    feature: Feature,
    grid: Grid,
    "featured-articles": FeaturedArticles,
  },
}));
