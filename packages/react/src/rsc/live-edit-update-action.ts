"use server";
import type { ISbStoryData } from "@storyblok/js";
import {
  type EditorTokenRejectionReason,
  type StoryblokEditorToken,
  verifyEditorToken,
} from "../core/editor-token";
import { getPreviewAccessTokenCandidates, PREVIEW_TOKEN_ENV_VAR } from "../core/state";
import { setCachedStory } from "../core/story-cache";

/**
 * Why the server rejected a live edit update.
 * - `invalid-request`: missing or malformed story or path.
 * - `no-server-token`: no preview access token is configured on the server.
 * - Every other value comes from verifying the Visual Editor token.
 */
export type LiveEditRejectionReason =
  | "invalid-request"
  | "no-server-token"
  | EditorTokenRejectionReason;

export type LiveEditUpdateResult = { ok: true } | { ok: false; reason: LiveEditRejectionReason };

const SERVER_MESSAGES: Record<LiveEditRejectionReason, string> = {
  "invalid-request": "invalid story or pathToRevalidate",
  "no-server-token": `no preview access token configured on the server. Set the ${PREVIEW_TOKEN_ENV_VAR} environment variable, or call storyblokInit({ accessToken }) with your preview access token in a server module.`,
  malformed: "rejected a request without a valid Visual Editor token",
  expired:
    "rejected an expired Visual Editor token. Reload the story in the Visual Editor to get a new one.",
  mismatch:
    "rejected a Visual Editor token that doesn't match the configured access token. The Visual Editor signs with the space's first preview access token; make sure the server uses that token. Otherwise the request was not sent by the Visual Editor.",
  "crypto-unavailable":
    "cannot verify the Visual Editor token because Web Crypto (crypto.subtle) is unavailable in this runtime.",
};

const reject = (reason: LiveEditRejectionReason): LiveEditUpdateResult => {
  console.error(`liveEditUpdateAction: ${SERVER_MESSAGES[reason]}`);
  return { ok: false, reason };
};

const isValidPath = (path: unknown): path is string =>
  typeof path === "string" && path.startsWith("/") && !path.startsWith("//") && path.length < 2048;

const isValidStory = (story: unknown): story is ISbStoryData =>
  !!story && typeof story === "object" && "id" in story && typeof story.id === "number";

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
}): Promise<LiveEditUpdateResult> {
  if (!isValidStory(story) || !isValidPath(pathToRevalidate)) {
    return reject("invalid-request");
  }

  const previewAccessTokens = getPreviewAccessTokenCandidates();
  if (previewAccessTokens.length === 0) {
    return reject("no-server-token");
  }

  const verification = await verifyEditorToken(editorToken, previewAccessTokens);
  if ("reason" in verification) {
    return reject(verification.reason);
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

  return { ok: true };
}
