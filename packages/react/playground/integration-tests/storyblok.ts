import { createApiClient } from "@storyblok/api-client";
import { defineStoryblokBlocks } from "@storyblok/react";
import type { Schema } from "./schema/blocks";
import Page from "./components/page";
import Teaser from "./components/teaser";
import Grid from "./components/grid";
import Feature from "./components/feature";
import FeaturedArticles from "./components/featured-articles";

export const apiClient = createApiClient({
  accessToken: import.meta.env.VITE_STORYBLOK_ACCESS_TOKEN,
  inlineRelations: true,
}).withTypes<Schema>();

export const { StoryblokBlock, StoryblokRichText } = defineStoryblokBlocks({
  components: {
    page: Page,
    teaser: Teaser,
    grid: Grid,
    feature: Feature,
    "featured-articles": FeaturedArticles,
  },
});
