import { createApiClient, defineStoryblokComponents } from "@storyblok/react";
import Page from "./components/page";
import Teaser from "./components/teaser";
import Grid from "./components/grid";
import Feature from "./components/feature";
import EmojiRandomizer from "./components/emiji-randomizer";

// https://app.storyblok.com/#/me/spaces/147897
export const apiClient = createApiClient({
  accessToken: "OurklwV5XsDJTIE1NJaD2wtt",
});

export const { StoryblokComponent, StoryblokRichText } = defineStoryblokComponents({
  components: {
    page: Page,
    teaser: Teaser,
    grid: Grid,
    feature: Feature,
    "emoji-randomizer": EmojiRandomizer,
  },
});
