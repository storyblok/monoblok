// Server-only (`.server` in the name), so the access token never reaches the browser.
import { createApiClient } from "@storyblok/api-client";

export const client = createApiClient({
  accessToken: import.meta.env.STORYBLOK_PREVIEW_TOKEN ?? "OurklwV5XsDJTIE1NJaD2wtt",
  inlineRelations: true,
});
