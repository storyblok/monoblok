import { createApiClient, defineStoryblokComponents } from "@storyblok/react";
import Feature from "@/components/Feature";
import Grid from "@/components/Grid";
import Page from "@/components/Page";
import Teaser from "@/components/Teaser";

export const apiClient = createApiClient({
  accessToken: "OurklwV5XsDJTIE1NJaD2wtt",
});

export const { StoryblokComponent, StoryblokRichText } = defineStoryblokComponents({
  components: { teaser: Teaser, page: Page, grid: Grid, feature: Feature },
});
