/**
 * Signed token that Storyblok's Visual Editor appends to the preview iframe URL
 * as `_storyblok_tk[space_id]`, `_storyblok_tk[timestamp]` and `_storyblok_tk[token]`.
 *
 * `token` is `sha1("<space_id>:<preview access token>:<timestamp>")`, so it can
 * only be produced by someone who knows the space's preview access token.
 * @see https://www.storyblok.com/faq/validate-storyblok-visual-editor-requests
 */
export interface StoryblokEditorToken {
  spaceId: string;
  timestamp: string;
  token: string;
}

/** Editor tokens older than this are rejected (matches Storyblok's documented window). */
export const EDITOR_TOKEN_MAX_AGE_SECONDS = 60 * 60;
/** Tolerated clock skew for timestamps slightly in the future. */
const EDITOR_TOKEN_MAX_FUTURE_SKEW_SECONDS = 5 * 60;

const EDITOR_TOKEN_STORAGE_KEY = "storyblok:editor-token";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export const isEditorToken = (value: unknown): value is StoryblokEditorToken => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const { spaceId, timestamp, token } = value as Record<string, unknown>;
  return (
    isNonEmptyString(spaceId) &&
    /^\d+$/.test(spaceId) &&
    isNonEmptyString(timestamp) &&
    /^\d+$/.test(timestamp) &&
    isNonEmptyString(token) &&
    /^[0-9a-f]{40}$/i.test(token)
  );
};

/**
 * Reads the editor token from the current URL (browser only). The token is kept
 * in `sessionStorage` so it survives client-side navigation inside the editor iframe.
 */
export const readEditorTokenFromLocation = (): StoryblokEditorToken | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const fromUrl = {
    spaceId: params.get("_storyblok_tk[space_id]") ?? "",
    timestamp: params.get("_storyblok_tk[timestamp]") ?? "",
    token: params.get("_storyblok_tk[token]") ?? "",
  };

  try {
    if (isEditorToken(fromUrl)) {
      window.sessionStorage?.setItem(EDITOR_TOKEN_STORAGE_KEY, JSON.stringify(fromUrl));
      return fromUrl;
    }
    const stored = window.sessionStorage?.getItem(EDITOR_TOKEN_STORAGE_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : null;
    return isEditorToken(parsed) ? parsed : null;
  } catch {
    return isEditorToken(fromUrl) ? fromUrl : null;
  }
};

const sha1Hex = async (input: string): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest("SHA-1", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const constantTimeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
};

/**
 * Verifies a Visual Editor token against the space's preview access token.
 * Returns `false` for any missing, malformed, expired or forged token.
 */
export const verifyEditorToken = async (
  editorToken: unknown,
  previewAccessToken: string | null | undefined,
  now: number = Date.now(),
): Promise<boolean> => {
  if (!isNonEmptyString(previewAccessToken) || !isEditorToken(editorToken)) {
    return false;
  }

  const timestamp = Number(editorToken.timestamp);
  const nowSeconds = Math.floor(now / 1000);
  if (
    !Number.isSafeInteger(timestamp) ||
    timestamp < nowSeconds - EDITOR_TOKEN_MAX_AGE_SECONDS ||
    timestamp > nowSeconds + EDITOR_TOKEN_MAX_FUTURE_SKEW_SECONDS
  ) {
    return false;
  }

  if (!globalThis.crypto?.subtle) {
    return false;
  }

  const expected = await sha1Hex(
    `${editorToken.spaceId}:${previewAccessToken}:${editorToken.timestamp}`,
  );
  return constantTimeEqual(expected, editorToken.token.toLowerCase());
};
