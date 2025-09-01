import type { APIRoute } from 'astro';
import { storyblokApiInstance } from 'virtual:storyblok-init';

export const GET: APIRoute = async ({ request }) => {
  const sbApi = storyblokApiInstance;

  const { data } = await sbApi.get(`cdn/stories/home`, {
    version: 'draft',
    resolve_relations: ['featured-articles.posts'],
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
