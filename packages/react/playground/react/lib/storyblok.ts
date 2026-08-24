import { createApiClient, createRegistry } from "@storyblok/react";

import EmojiRandomizer from "../components/emiji-randomizer";
import Feature from "../components/feature";
import Grid from "../components/grid";
import Page from "../components/page";
import Teaser from "../components/teaser";

// https://app.storyblok.com/#/me/spaces/147897
export const client = createApiClient({
  accessToken: "OurklwV5XsDJTIE1NJaD2wtt",
});

export const { StoryblokComponent, StoryblokRichText } = createRegistry({
  components: {
    teaser: Teaser,
    grid: Grid,
    feature: Feature,
    page: Page,
    "emoji-randomizer": EmojiRandomizer,
  },
});
