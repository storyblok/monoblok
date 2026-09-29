import { createApiClient } from "@storyblok/api-client";
import { defineStoryblokBlocks } from "@storyblok/react";
import EmojiRandomizer from "@/app/components/EmojiRandomizer";
import Grid from "@/app/components/Grid";
import Page from "@/app/components/Page";
import Teaser from "@/app/components/Teaser";
import WeatherWidget from "@/app/components/WeatherWidget";

export const apiClient = createApiClient({
  accessToken: process.env.STORYBLOK_ACCESS_TOKEN ?? "OurklwV5XsDJTIE1NJaD2wtt",
});

export const { StoryblokBlock, StoryblokRichText } = defineStoryblokBlocks({
  components: {
    teaser: Teaser,
    page: Page,
    grid: Grid,
    "emoji-randomizer": EmojiRandomizer,
    weather_widget: WeatherWidget,
  },
});
