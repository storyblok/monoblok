import { createApiClient, createRegistry } from "@storyblok/react";
import EmojiRandomizer from "@/app/components/EmojiRandomizer";
import Grid from "@/app/components/Grid";
import IFrameEmbed from "@/app/components/IFrameEmbed";
import Page from "@/app/components/Page";
import Teaser from "@/app/components/Teaser";
import WeatherWidget, { WeatherWidgetSkeleton } from "@/app/components/WeatherWidget";

// https://app.storyblok.com/#/me/spaces/147897
export const client = createApiClient({
  accessToken: "OurklwV5XsDJTIE1NJaD2wtt",
});

export const { StoryblokComponent, StoryblokRichText } = createRegistry({
  components: {
    teaser: Teaser,
    page: Page,
    grid: Grid,
    "emoji-randomizer": EmojiRandomizer,
    "iframe-embed": IFrameEmbed,
    weather_widget: {
      component: WeatherWidget,
      suspense: true,
    },
  },
  suspenseFallback: <WeatherWidgetSkeleton />,
});
