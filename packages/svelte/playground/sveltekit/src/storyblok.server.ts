// Server-only (`.server` in the name), so the access token never reaches the browser.
import { createApiClient } from "@storyblok/api-client";

export const client = createApiClient({
  accessToken: "OurklwV5XsDJTIE1NJaD2wtt",
});
