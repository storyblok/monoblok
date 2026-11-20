import { apiPlugin, storyblokInit } from "@storyblok/react/rsc";
import Feature from "@/components/feature";
import FeaturedArticles from "@/components/featured-articles";
import Grid from "@/components/grid";
import Page from "@/components/page";
import Teaser from "@/components/teaser";

// Falls back to the public demo space so the app boots without
// STORYBLOK_ACCESS_TOKEN; `qa:dev` always sets it to the QA space's token so
// `_uid`-addressed assertions find the seeded content.
const DEMO_ACCESS_TOKEN = "OurklwV5XsDJTIE1NJaD2wtt";

// Written exactly like the Next.js blueprint (`blueprints/blueprint-core-nextjs`),
// including being imported by a `"use client"` provider, so QA exercises what an
// existing v7 project runs after upgrading, without code changes.
export const getStoryblokApi = storyblokInit({
  accessToken: process.env.STORYBLOK_ACCESS_TOKEN ?? DEMO_ACCESS_TOKEN,
  use: [apiPlugin],
  components: {
    page: Page,
    teaser: Teaser,
    grid: Grid,
    feature: Feature,
    "featured-articles": FeaturedArticles,
  },
});
