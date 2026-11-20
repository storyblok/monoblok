import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EDITOR_TOKEN_MAX_AGE_SECONDS,
  EDITOR_TOKEN_MAX_FUTURE_SKEW_SECONDS,
  EDITOR_TOKEN_STORAGE_KEY,
  readEditorTokenFromLocation,
  verifyEditorToken,
} from "../core/editor-token";

const PREVIEW_TOKEN = "preview-token-abc";
const SPACE_ID = "12345";
const NOW = 1_700_000_000_000;
const NOW_SECONDS = NOW / 1000;

const sign = (timestamp: number, previewToken = PREVIEW_TOKEN) =>
  createHash("sha1").update(`${SPACE_ID}:${previewToken}:${timestamp}`).digest("hex");

const tokenAt = (timestamp: number, previewToken = PREVIEW_TOKEN) => ({
  spaceId: SPACE_ID,
  timestamp: String(timestamp),
  token: sign(timestamp, previewToken),
});

describe("verifyEditorToken", () => {
  it("accepts a valid token", async () => {
    await expect(verifyEditorToken(tokenAt(NOW_SECONDS), [PREVIEW_TOKEN], NOW)).resolves.toEqual({
      valid: true,
    });
  });

  it("accepts an uppercase signature", async () => {
    const token = tokenAt(NOW_SECONDS);
    await expect(
      verifyEditorToken({ ...token, token: token.token.toUpperCase() }, [PREVIEW_TOKEN], NOW),
    ).resolves.toEqual({ valid: true });
  });

  it("accepts a token that matches any of several candidates", async () => {
    await expect(
      verifyEditorToken(tokenAt(NOW_SECONDS), ["public-token", PREVIEW_TOKEN], NOW),
    ).resolves.toEqual({ valid: true });
  });

  it("rejects a token signed with another access token", async () => {
    await expect(
      verifyEditorToken(tokenAt(NOW_SECONDS, "other"), [PREVIEW_TOKEN], NOW),
    ).resolves.toEqual({ valid: false, reason: "mismatch" });
  });

  it("rejects when there are no candidates", async () => {
    await expect(verifyEditorToken(tokenAt(NOW_SECONDS), [], NOW)).resolves.toEqual({
      valid: false,
      reason: "mismatch",
    });
  });

  it.each([
    ["exactly at the max age", NOW_SECONDS - EDITOR_TOKEN_MAX_AGE_SECONDS, true],
    ["one second past the max age", NOW_SECONDS - EDITOR_TOKEN_MAX_AGE_SECONDS - 1, false],
    ["exactly at the future skew", NOW_SECONDS + EDITOR_TOKEN_MAX_FUTURE_SKEW_SECONDS, true],
    [
      "one second past the future skew",
      NOW_SECONDS + EDITOR_TOKEN_MAX_FUTURE_SKEW_SECONDS + 1,
      false,
    ],
  ])("handles a timestamp %s", async (_label, timestamp, valid) => {
    await expect(verifyEditorToken(tokenAt(timestamp), [PREVIEW_TOKEN], NOW)).resolves.toEqual(
      valid ? { valid: true } : { valid: false, reason: "expired" },
    );
  });

  it.each([
    ["null", null],
    ["a string", "token"],
    ["a non-numeric space id", { ...tokenAt(NOW_SECONDS), spaceId: "abc" }],
    ["a raw release access key", { ...tokenAt(NOW_SECONDS), token: "AbCdEfGhIjKlMnOpQrStUvWx" }],
  ])("rejects %s as malformed", async (_label, value) => {
    await expect(verifyEditorToken(value, [PREVIEW_TOKEN], NOW)).resolves.toEqual({
      valid: false,
      reason: "malformed",
    });
  });

  it("reports a runtime without Web Crypto", async () => {
    vi.stubGlobal("crypto", undefined);
    try {
      await expect(verifyEditorToken(tokenAt(NOW_SECONDS), [PREVIEW_TOKEN], NOW)).resolves.toEqual({
        valid: false,
        reason: "crypto-unavailable",
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("readEditorTokenFromLocation", () => {
  const signed = tokenAt(NOW_SECONDS);
  const searchFor = (token: string) =>
    `?_storyblok=1&_storyblok_tk[space_id]=${SPACE_ID}&_storyblok_tk[timestamp]=${NOW_SECONDS}&_storyblok_tk[token]=${token}`;

  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.location.search = "";
  });

  it("reads the token from the URL and stores it", () => {
    window.location.search = searchFor(signed.token);

    expect(readEditorTokenFromLocation()).toEqual({ status: "ok", editorToken: signed });
    expect(window.sessionStorage.getItem(EDITOR_TOKEN_STORAGE_KEY)).toBe(JSON.stringify(signed));
  });

  it("falls back to the stored token after client-side navigation", () => {
    window.sessionStorage.setItem(EDITOR_TOKEN_STORAGE_KEY, JSON.stringify(signed));
    window.location.search = "";

    expect(readEditorTokenFromLocation()).toEqual({ status: "ok", editorToken: signed });
  });

  it("reports a missing token", () => {
    expect(readEditorTokenFromLocation()).toEqual({ status: "missing" });
  });

  it("detects a restricted release key and drops a stale stored token", () => {
    window.sessionStorage.setItem(EDITOR_TOKEN_STORAGE_KEY, JSON.stringify(signed));
    window.location.search = searchFor("AbCdEfGhIjKlMnOpQrStUvWx");

    expect(readEditorTokenFromLocation()).toEqual({ status: "restricted-release" });
    expect(window.sessionStorage.getItem(EDITOR_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it("does not fall back to a stored token when the URL token is malformed", () => {
    window.sessionStorage.setItem(EDITOR_TOKEN_STORAGE_KEY, JSON.stringify(signed));
    window.location.search = searchFor("");

    expect(readEditorTokenFromLocation()).toEqual({ status: "missing" });
  });

  it("ignores a corrupted stored token", () => {
    window.sessionStorage.setItem(EDITOR_TOKEN_STORAGE_KEY, "{not json");

    expect(readEditorTokenFromLocation()).toEqual({ status: "missing" });
  });
});
