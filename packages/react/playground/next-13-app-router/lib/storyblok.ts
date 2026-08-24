import { createApiClient, createRegistry } from "@storyblok/react";
import Page from "@/components/Page";
import Teaser from "@/components/Teaser";

// https://app.storyblok.com/#/me/spaces/147897
export const client = createApiClient({
  accessToken: "OurklwV5XsDJTIE1NJaD2wtt",
});

export const { StoryblokComponent } = createRegistry({
  components: {
    teaser: Teaser,
    page: Page,
  },
});
