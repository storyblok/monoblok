import { defineMiddleware } from "astro/middleware";
import { isInEditor } from "@storyblok/live-preview";

/**
 * Captures the Visual Editor's POST payload on `Astro.locals` so pages can
 * read it back with `getPayload`.
 */
export const liveEditMiddleware = defineMiddleware(async ({ locals, request }, next) => {
  if (request.method === "POST") {
    // First do a check if its coming from within storyblok
    const editorRequest = isInEditor(new URL(request.url));

    if (editorRequest) {
      try {
        // Create a copy of the request
        const requestBody = await request.clone().json();
        if (requestBody?.story?.is_storyblok_preview) {
          locals._storyblok_preview_data = requestBody;
        }
      } catch (error) {
        console.error("Error reading request body:", error);
      }
    }
  }
  return next();
});
