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
export const EDITOR_TOKEN_MAX_FUTURE_SKEW_SECONDS = 5 * 60;

export const EDITOR_TOKEN_STORAGE_KEY = "storyblok:editor-token";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isDigits = (value: unknown): value is string =>
  isNonEmptyString(value) && /^\d+$/.test(value);

const isSha1Hex = (value: unknown): value is string =>
  isNonEmptyString(value) && /^[0-9a-f]{40}$/i.test(value);

export const isEditorToken = (value: unknown): value is StoryblokEditorToken =>
  !!value &&
  typeof value === "object" &&
  "spaceId" in value &&
  "timestamp" in value &&
  "token" in value &&
  isDigits(value.spaceId) &&
  isDigits(value.timestamp) &&
  isSha1Hex(value.token);

/**
 * Result of reading the editor token in the browser.
 * - `restricted-release`: the editor sent a raw release access key instead of a
 *   signature (restricted release previews), which the server cannot verify.
 */
export type EditorTokenReadResult =
  | { status: "ok"; editorToken: StoryblokEditorToken }
  | { status: "missing" }
  | { status: "restricted-release" };

const getSessionStorage = (): Storage | null => {
  try {
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
};

const readStoredEditorToken = (storage: Storage | null): StoryblokEditorToken | null => {
  try {
    const stored = storage?.getItem(EDITOR_TOKEN_STORAGE_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : null;
    return isEditorToken(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const safeStorageCall = (callback: () => void): void => {
  try {
    callback();
  } catch {
    // Storage can throw (quota, privacy mode); the token in the URL still works.
  }
};

/**
 * Reads the editor token from the current URL (browser only). The token is kept
 * in `sessionStorage` so it survives client-side navigation inside the editor iframe.
 *
 * When the URL carries `_storyblok_tk` parameters, they are authoritative: a stored
 * token from an earlier story is never used in their place.
 */
export const readEditorTokenFromLocation = (): EditorTokenReadResult => {
  if (typeof window === "undefined") {
    return { status: "missing" };
  }

  const params = new URLSearchParams(window.location.search);
  const rawToken = params.get("_storyblok_tk[token]");
  const storage = getSessionStorage();

  if (rawToken !== null) {
    const fromUrl = {
      spaceId: params.get("_storyblok_tk[space_id]") ?? "",
      timestamp: params.get("_storyblok_tk[timestamp]") ?? "",
      token: rawToken,
    };
    if (isEditorToken(fromUrl)) {
      safeStorageCall(() => storage?.setItem(EDITOR_TOKEN_STORAGE_KEY, JSON.stringify(fromUrl)));
      return { status: "ok", editorToken: fromUrl };
    }
    safeStorageCall(() => storage?.removeItem(EDITOR_TOKEN_STORAGE_KEY));
    // A non-signature token is the raw access key of a restricted release.
    return isNonEmptyString(rawToken) && !isSha1Hex(rawToken)
      ? { status: "restricted-release" }
      : { status: "missing" };
  }

  const stored = readStoredEditorToken(storage);
  return stored ? { status: "ok", editorToken: stored } : { status: "missing" };
};

/**
 * Why a token failed verification.
 * - `malformed`: missing fields or not a SHA-1 signature.
 * - `expired`: the timestamp is outside the accepted window.
 * - `mismatch`: the signature doesn't match any configured preview access token.
 * - `crypto-unavailable`: the runtime has no Web Crypto (`crypto.subtle`).
 */
export type EditorTokenRejectionReason =
  | "malformed"
  | "expired"
  | "mismatch"
  | "crypto-unavailable";

export type EditorTokenVerification =
  | { valid: true }
  | { valid: false; reason: EditorTokenRejectionReason };

const sha1Hex = async (subtle: SubtleCrypto, input: string): Promise<string> => {
  const digest = await subtle.digest("SHA-1", new TextEncoder().encode(input));
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
 * Verifies a Visual Editor token against one or more preview access tokens.
 * The Visual Editor signs with the space's first preview access token, so
 * passing several candidates lets apps with more than one token configured work.
 */
export const verifyEditorToken = async (
  editorToken: unknown,
  previewAccessTokens: readonly string[],
  now: number = Date.now(),
): Promise<EditorTokenVerification> => {
  if (!isEditorToken(editorToken)) {
    return { valid: false, reason: "malformed" };
  }

  const timestamp = Number(editorToken.timestamp);
  const nowSeconds = Math.floor(now / 1000);
  if (
    !Number.isSafeInteger(timestamp) ||
    timestamp < nowSeconds - EDITOR_TOKEN_MAX_AGE_SECONDS ||
    timestamp > nowSeconds + EDITOR_TOKEN_MAX_FUTURE_SKEW_SECONDS
  ) {
    return { valid: false, reason: "expired" };
  }

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    return { valid: false, reason: "crypto-unavailable" };
  }

  const received = editorToken.token.toLowerCase();
  let matched = false;
  // Check every candidate (no early exit) so timing doesn't reveal which one matched.
  for (const previewAccessToken of previewAccessTokens) {
    if (!isNonEmptyString(previewAccessToken)) {
      continue;
    }
    const expected = await sha1Hex(
      subtle,
      `${editorToken.spaceId}:${previewAccessToken}:${editorToken.timestamp}`,
    );
    matched = constantTimeEqual(expected, received) || matched;
  }

  return matched ? { valid: true } : { valid: false, reason: "mismatch" };
};
