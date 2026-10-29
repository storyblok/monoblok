import type { PageLoad } from "./$types";
import { client } from "$lib/storyblok";

export const load: PageLoad = async ({ params }) => {
  const slug = params.slug && params.slug !== "" ? params.slug : "home";

  const { data, error } = await client.stories.get(slug, { query: { version: "draft" } });

  if (!data) {
    throw error ?? new Error(`Story not found for slug "${slug}"`);
  }

  return {
    story: data.story,
  };
};
