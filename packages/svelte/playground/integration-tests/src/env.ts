import { defineEnvVars } from "@sveltejs/kit/env";

export const variables = defineEnvVars({
  // Visual Editor QA sets it to the QA space's token. Falls back to the demo space.
  STORYBLOK_PREVIEW_TOKEN: { schema: (value) => value || "OurklwV5XsDJTIE1NJaD2wtt" },
});
