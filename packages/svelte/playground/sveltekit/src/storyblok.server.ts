// Server-only (`.server` in the name), so the access token never reaches the browser.
import { STORYBLOK_DELIVERY_API_TOKEN } from "$app/env/private";
import { createApiClient } from "@storyblok/api-client";

export const client = createApiClient({
  accessToken: STORYBLOK_DELIVERY_API_TOKEN,
});
