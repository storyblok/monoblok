import { createApiClient, defineStoryblokComponents } from "@storyblok/react";
import EmojiRandomizer from "@/app/components/storyblok/EmojiRandomizer";
import Feature from "@/app/components/storyblok/Feature";
import Grid from "@/app/components/storyblok/Grid";
import Page from "@/app/components/storyblok/Page";
import Teaser from "@/app/components/storyblok/Teaser";
import { WeatherWidget } from "@/app/components/storyblok/WeatherWidget";
import { WeatherWidgetSkeleton } from "@/app/components/storyblok/WeatherWidgetSkeleton";

export const apiClient = createApiClient({
  accessToken: "OurklwV5XsDJTIE1NJaD2wtt",
});

export const { StoryblokComponent, StoryblokRichText } = defineStoryblokComponents({
  components: {
    teaser: Teaser,
    page: Page,
    grid: Grid,
    "emoji-randomizer": EmojiRandomizer,
    feature: Feature,
    weather_widget: {
      component: WeatherWidget,
      fallback: <WeatherWidgetSkeleton />,
      suspense: true,
    },
  },
});
