import { createApiClient } from "@storyblok/api-client";
import { defineStoryblokBlocks } from "@storyblok/react";
import Feature from "@/components/Feature";
import Grid from "@/components/Grid";
import Page from "@/components/Page";
import Teaser from "@/components/Teaser";

export const apiClient = createApiClient({
  accessToken: process.env.STORYBLOK_ACCESS_TOKEN ?? "OurklwV5XsDJTIE1NJaD2wtt",
});

export const { StoryblokBlock, StoryblokRichText } = defineStoryblokBlocks({
  components: { teaser: Teaser, page: Page, grid: Grid, feature: Feature },
});
