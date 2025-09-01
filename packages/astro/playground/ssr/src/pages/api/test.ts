import type { APIRoute } from 'astro';
import { storyblokApiInstance } from 'virtual:storyblok-init';

export const GET: APIRoute = ({ request }) => {
  console.log(storyblokApiInstance);

  return new Response(
    JSON.stringify({
      path: new URL(request.url).pathname,
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
