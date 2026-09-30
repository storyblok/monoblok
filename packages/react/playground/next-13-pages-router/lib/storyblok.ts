import { createApiClient } from "@storyblok/api-client";
import { defineStoryblokBlocks } from "@storyblok/react";
import FallbackComponent from "../components/fallback-component";
import Feature from "../components/feature";
import Grid from "../components/grid";
import Page from "../components/page";
import Teaser from "../components/teaser";

export const apiClient = createApiClient({
  accessToken: process.env.STORYBLOK_ACCESS_TOKEN ?? "OurklwV5XsDJTIE1NJaD2wtt",
});

export const { StoryblokBlock, StoryblokRichText } = defineStoryblokBlocks({
  components: { teaser: Teaser, grid: Grid, feature: Feature, page: Page },
  fallback: FallbackComponent,
});
