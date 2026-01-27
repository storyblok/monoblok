import { defineMiddleware } from 'astro/middleware';
import { isEditorRequest } from '@storyblok/astro';

export const onRequest = defineMiddleware(async ({ locals, request }, next) => {
  if (request.method === 'POST') {
    // First do a check if its coming from within storyblok
    const editorRequest
      = isEditorRequest(new URL(request.url));

    if (editorRequest) {
      try {
        // Create a copy of the request
        const requestBody = await request.clone().json();
        if (requestBody?.story?.is_storyblok_preview) {
          locals._storyblok_preview_data = requestBody;
        }
      }
      catch (error) {
        console.error('Error reading request body:', error);
      }
    }
  }
  return next();
});
