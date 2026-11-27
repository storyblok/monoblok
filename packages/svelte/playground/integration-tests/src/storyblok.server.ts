// Server-only (`.server` in the name), so the access token never reaches the browser.
import { STORYBLOK_PREVIEW_TOKEN } from "$app/env/private";
import { createApiClient } from "@storyblok/api-client";

export const client = createApiClient({
  accessToken: STORYBLOK_PREVIEW_TOKEN,
  inlineRelations: true,
});
