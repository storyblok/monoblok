import { createApiClient, createRegistry } from "@storyblok/react";
import FallbackComponent from "../components/fallback-component";
import Feature from "../components/feature";
import Grid from "../components/grid";
import Page from "../components/page";
import Teaser from "../components/teaser";

// https://app.storyblok.com/#/me/spaces/147897
export const client = createApiClient({
  accessToken: "d6IKUtAUDiKyAhpJtrLFcwtt",
});

export const { StoryblokComponent } = createRegistry({
  components: {
    teaser: Teaser,
    grid: Grid,
    feature: Feature,
    page: Page,
  },
  fallback: FallbackComponent,
});
