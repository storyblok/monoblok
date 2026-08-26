import { createApiClient, defineStoryblokComponents } from "@storyblok/react";
import Page from "@/components/Page";
import Teaser from "@/components/Teaser";

export const apiClient = createApiClient({
  accessToken: "OurklwV5XsDJTIE1NJaD2wtt",
});

export const { StoryblokComponent, StoryblokRichText } = defineStoryblokComponents({
  components: { teaser: Teaser, page: Page },
});
