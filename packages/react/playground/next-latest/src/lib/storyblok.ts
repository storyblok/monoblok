import { createApiClient, defineStoryblokComponents } from "@storyblok/react";
import EmojiRandomizer from "@/app/components/EmojiRandomizer";
import Grid from "@/app/components/Grid";
import Page from "@/app/components/Page";
import Teaser from "@/app/components/Teaser";

export const apiClient = createApiClient({
  accessToken: "OurklwV5XsDJTIE1NJaD2wtt",
});

export const { StoryblokComponent, StoryblokRichText } = defineStoryblokComponents({
  components: {
    teaser: Teaser,
    page: Page,
    grid: Grid,
    "emoji-randomizer": EmojiRandomizer,
  },
});
