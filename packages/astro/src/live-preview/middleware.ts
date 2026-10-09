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
    // First do a check if its coming from within storyblok
    const editorRequest = isInEditor(new URL(request.url));

    // The `_storyblok*` params above are public and guessable, so they can't
    // gate this alone. A plain HTML form can forge a cross-site POST without
    // a CORS preflight, but only with `Content-Type: text/plain`,
    // `multipart/form-data`, or `application/x-www-form-urlencoded` — never
    // `application/json`. Requiring it here forces any cross-origin caller
    // through a preflight, which `Sec-Fetch-Site` then catches: the preview
    // bridge's own POST (`getNewHTMLBody`) is always same-origin, so a
    // present, non-`same-origin` value can only mean a cross-site request.
    const isJson = (request.headers.get("content-type") ?? "")
      .toLowerCase()
      .includes("application/json");
    const secFetchSite = request.headers.get("sec-fetch-site");
    const isSameOrigin = secFetchSite === null || secFetchSite === "same-origin";

    if (editorRequest && isJson && isSameOrigin) {
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
