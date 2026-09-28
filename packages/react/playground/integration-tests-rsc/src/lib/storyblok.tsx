import { createApiClient } from "@storyblok/api-client";
import { defineStoryblokComponents } from "@storyblok/react";
import type { Schema } from "@/schema/blocks";
import Page from "@/components/page";
import Teaser from "@/components/teaser";
import Grid from "@/components/grid";
import Feature from "@/components/feature";
import FeaturedArticles from "@/components/featured-articles";

// Falls back to the shared public demo space (same one playground/react uses)
// so the app still boots without STORYBLOK_ACCESS_TOKEN; `qa:dev:rsc` always
// overrides it with the QA space's token so `_uid`-addressed assertions can
// find seeded content.
const DEMO_ACCESS_TOKEN = "OurklwV5XsDJTIE1NJaD2wtt";

export const apiClient = createApiClient({
  accessToken: process.env.STORYBLOK_ACCESS_TOKEN ?? DEMO_ACCESS_TOKEN,
  inlineRelations: true,
}).withTypes<Schema>();

export const { StoryblokComponent, StoryblokRichText } = defineStoryblokComponents({
  components: {
    page: Page,
    teaser: Teaser,
    grid: Grid,
    feature: Feature,
    "featured-articles": FeaturedArticles,
  },
});
