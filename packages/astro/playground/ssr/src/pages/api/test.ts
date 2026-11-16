import { client } from "../../storyblok";
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ request }) => {
  const { data } = await client.stories.get("home", {
    query: {
      version: "draft",
      resolve_relations: "featured-articles.posts",
    },
  });
  const story = data?.story;
  return new Response(
    JSON.stringify({
      path: new URL(request.url).pathname,
      story,
    }),
  );
};
export const POST: APIRoute = async ({ request }) => {
  return new Response(
    JSON.stringify({
      body: await request.json(),
    }),
  );
};
