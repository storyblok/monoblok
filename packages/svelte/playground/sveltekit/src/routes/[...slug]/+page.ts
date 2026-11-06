import type { PageLoad } from "./$types";
import { client } from "../../storyblok";

export const load: PageLoad = async ({ params }) => {
  const slug = params.slug && params.slug !== "" ? params.slug : "home";

  const { data, error } = await client.stories.get(slug, {
    // Match the bridge options in `+page.svelte`, so editor updates keep the same shape.
    query: { version: "draft", resolve_links: "url" },
  });

  if (!data) {
    throw error ?? new Error(`Story not found for slug "${slug}"`);
  }

  return {
    story: data.story,
  };
};
