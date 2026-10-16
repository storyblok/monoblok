import { defineMiddleware } from "astro/middleware";
import { isInEditor } from "@storyblok/live-preview";

/**
 * Captures the Visual Editor's POST payload on `Astro.locals` so pages can
 * read it back with `getPayload`.
 *
 * @example
 * ```ts
 * // src/middleware.ts
 * import { sequence } from 'astro:middleware';
 * import { storyblokPreviewMiddleware } from '@storyblok/astro';
 *
 * export const onRequest = sequence(storyblokPreviewMiddleware);
 * ```
 */
export const storyblokPreviewMiddleware = defineMiddleware(async ({ locals, request }, next) => {
  if (request.method === "POST") {
    // The `_storyblok*` query params are public and guessable, so they can't gate this alone.
    // Requiring a real `application/json` content type forces a CORS preflight, and
    // `Sec-Fetch-Site` rejects anything that isn't same-origin.
    const editorRequest = isInEditor(new URL(request.url));
    const mimeEssence = (request.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const isJson = mimeEssence === "application/json";
    const secFetchSite = request.headers.get("sec-fetch-site");
    const isSameOrigin = secFetchSite === null || secFetchSite === "same-origin";

    if (editorRequest && isJson && isSameOrigin) {
      try {
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
