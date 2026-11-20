"use server";
import type { ISbStoryData } from "@storyblok/js";
import { type StoryblokEditorToken, verifyEditorToken } from "../core/editor-token";
import { getPreviewAccessToken } from "../core/state";
import { setCachedStory } from "../core/story-cache";

const isValidPath = (path: unknown): path is string =>
  typeof path === "string" && path.startsWith("/") && !path.startsWith("//") && path.length < 2048;

const isValidStory = (story: unknown): story is ISbStoryData =>
  !!story && typeof story === "object" && typeof (story as ISbStoryData).id === "number";

/**
 * Server action used by `StoryblokLiveEditing` to push Visual Editor changes to
 * the server-rendered tree.
 *
 * Server actions are public HTTP endpoints, so every call must carry a valid
 * Storyblok Visual Editor token (see `verifyEditorToken`). Requests without one
 * are rejected and never touch the story cache.
 */
export async function liveEditUpdateAction({
  story,
  pathToRevalidate,
  editorToken,
}: {
  story: ISbStoryData;
  pathToRevalidate: string;
  editorToken?: StoryblokEditorToken | null;
}) {
  if (!story || !pathToRevalidate) {
    return console.error("liveEditUpdateAction: story or pathToRevalidate is not provided");
  }

  const previewAccessToken = getPreviewAccessToken();
  if (!previewAccessToken) {
    return console.error(
      "liveEditUpdateAction: no access token configured on the server. Call storyblokInit({ accessToken }) with your preview token in a server module to enable live editing.",
    );
  }

  if (!(await verifyEditorToken(editorToken, previewAccessToken))) {
    return console.error("liveEditUpdateAction: rejected request without a valid editor token");
  }

  if (!isValidStory(story) || !isValidPath(pathToRevalidate)) {
    return console.error("liveEditUpdateAction: invalid story or pathToRevalidate");
  }

  setCachedStory(story);

  // Revalidate path in Next.js SDKs only
  if (process.env.NEXT_RUNTIME) {
    try {
      const { revalidatePath } = await import("next/cache");
      revalidatePath(pathToRevalidate);
    } catch (error) {
      console.error("liveEditUpdateAction: error while revalidating path", error);
    }
  }
}
