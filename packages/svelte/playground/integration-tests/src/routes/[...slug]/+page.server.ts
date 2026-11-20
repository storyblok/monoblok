import type { PageServerLoad } from "./$types";
import { client } from "../../storyblok.server";

export const load: PageServerLoad = async ({ params }) => {
  const slug = params.slug && params.slug !== "" ? params.slug : "home";

  const { data, error } = await client.stories.get(slug, {
    query: {
      version: "draft",
      // Match the bridge options in `+page.svelte`, so editor updates keep the same shape.
      resolve_links: "url",
      resolve_relations: "featured-articles.posts",
    },
  });

  if (!data) {
    throw error ?? new Error(`Story not found for slug "${slug}"`);
  }

  return {
    story: data.story,
  };
};
