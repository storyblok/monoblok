import { HttpResponse } from "msw";

/**
 * Answers a published request without a `cv` as the origin does: a 301 to the same URL with
 * the current `cv`. Returns `undefined` for any other request, which the handler then serves.
 */
export const redirectToCurrentCv = (request: Request, currentCv: number) => {
  const url = new URL(request.url);
  if (url.searchParams.has("cv") || url.searchParams.get("version") === "draft") {
    return undefined;
  }
  url.searchParams.set("cv", String(currentCv));
  return HttpResponse.redirect(url.toString(), 301);
};
