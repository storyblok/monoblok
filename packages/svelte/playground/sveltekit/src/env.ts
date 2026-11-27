import { defineEnvVars } from "@sveltejs/kit/env";

export const variables = defineEnvVars({
  // Falls back to the demo space.
  STORYBLOK_DELIVERY_API_TOKEN: { schema: (value) => value || "OurklwV5XsDJTIE1NJaD2wtt" },
});
