import { describe, expect, it } from "vitest";
import type { CredentialContext } from "./credential-context";
import { formatSpaceNotAllowedMessage, matchCredentialError } from "./credential-hint";

const oauth: CredentialContext = { kind: "oauth" };
const pat: CredentialContext = { kind: "pat" };
const unknown: CredentialContext = { kind: "unknown" };

describe("matchCredentialError", () => {
  it("should name the missing permission and the consent screen for an OAuth session", () => {
    const hint = matchCredentialError(403, "Insufficient scope: stories:write is required", oauth);

    expect(hint).toEqual({
      errorId: "insufficient_scope",
      fatal: true,
      message:
        'Your OAuth login is missing the "stories:write" permission. Run `storyblok logout`, then `storyblok login --oauth` and grant it at the consent screen.',
    });
  });

  it("should name the missing scope and token creation for a PAT session", () => {
    const hint = matchCredentialError(403, "Insufficient scope: assets:write is required", pat);

    expect(hint?.errorId).toBe("insufficient_scope");
    expect(hint?.message).toBe(
      'Your personal access token is missing the "assets:write" scope. Create a new token with that scope under My account, Personal access tokens. Run `storyblok logout`, then `storyblok login --token <token>` to use it.',
    );
  });

  it("should tell OAuth users to use a personal access token for unsupported endpoints", () => {
    const hint = matchCredentialError(403, "This endpoint does not support this token type", oauth);

    expect(hint?.errorId).toBe("forbidden");
    expect(hint?.message).toBe(
      "This command is not available with an OAuth login yet. Run `storyblok logout`, then `storyblok login --token <token>` with a personal access token instead.",
    );
  });

  it("should tell PAT users to sign in with email and password for unsupported endpoints", () => {
    const hint = matchCredentialError(403, "This endpoint does not support this token type", pat);

    expect(hint?.message).toBe(
      "This command is not available with a personal access token. Run `storyblok logout`, then `storyblok login` and sign in with your email and password.",
    );
  });

  it("should list the authorized space ids when the credential is space restricted", () => {
    const hint = matchCredentialError(403, "This token is restricted to specific spaces", {
      kind: "oauth",
      spaces: [
        { id: 12345, region: "eu" },
        { id: 67890, region: "eu" },
      ],
    });

    expect(hint?.message).toBe(
      "Your OAuth login is limited to specific spaces. Pass --space with one of: 12345, 67890.",
    );
  });

  it("should fall back to a generic --space hint when the space ids are unknown", () => {
    const hint = matchCredentialError(403, "This token is restricted to specific spaces", oauth);

    expect(hint?.message).toBe(
      "Your OAuth login is limited to specific spaces. Pass --space <id>.",
    );
  });

  it("should reuse the pre-flight wording when the space is outside the grant", () => {
    const hint = matchCredentialError(403, "This token does not have access to this space", {
      kind: "oauth",
      space: 999,
      spaces: [
        { id: 1, region: "eu" },
        { id: 2, region: "eu" },
      ],
    });

    expect(hint?.message).toBe(formatSpaceNotAllowedMessage(999, [1, 2]));
  });

  it("should name the personal access token and a remedy it can act on for a space-restricted PAT", () => {
    const hint = matchCredentialError(403, "This token does not have access to this space", {
      kind: "pat",
      space: 222,
      spaces: [],
    });

    expect(hint?.message).toBe(
      "Space 222 is not covered by your personal access token. Create a new token that covers this space under My account, Personal access tokens. Run `storyblok logout`, then `storyblok login --token <token>` to use it.",
    );
  });

  it("should omit the empty parenthetical for an OAuth grant with no known space list", () => {
    const hint = matchCredentialError(403, "This token does not have access to this space", {
      kind: "oauth",
      space: 222,
      spaces: [],
    });

    expect(hint?.message).toBe(
      "Space 222 is not covered by your OAuth login. Run `storyblok logout`, then `storyblok login --oauth` and select this space at the consent screen.",
    );
    expect(hint?.message).not.toContain("(authorized spaces: )");
  });

  it("should treat a 401 as a dead session regardless of the body", () => {
    expect(matchCredentialError(401, "Unauthorized", oauth)?.message).toBe(
      "Your OAuth login is no longer valid, it may have been revoked or expired. Run `storyblok logout`, then `storyblok login --oauth` to sign in again.",
    );
    expect(matchCredentialError(401, undefined, pat)?.message).toBe(
      "Your personal access token was rejected. It may have been revoked; create a new one. Run `storyblok logout`, then `storyblok login --token <token>` to use it.",
    );
  });

  it("should mark every credential failure as fatal", () => {
    const cases = [
      matchCredentialError(403, "Insufficient scope: stories:write is required", oauth),
      matchCredentialError(403, "This endpoint does not support this token type", oauth),
      matchCredentialError(403, "This token is restricted to specific spaces", oauth),
      matchCredentialError(403, "This token does not have access to this space", oauth),
      matchCredentialError(401, "Unauthorized", oauth),
    ];

    expect(cases.every((hint) => hint?.fatal === true)).toBe(true);
  });

  it("should ignore every status when the credential kind is unknown", () => {
    expect(
      matchCredentialError(403, "Insufficient scope: stories:write is required", unknown),
    ).toBeUndefined();
    expect(matchCredentialError(401, "Unauthorized", unknown)).toBeUndefined();
  });

  it("should not claim unrelated forbidden responses", () => {
    expect(
      matchCredentialError(403, "Asset conversion is not available on this plan", oauth),
    ).toBeUndefined();
    expect(matchCredentialError(403, undefined, oauth)).toBeUndefined();
  });

  it("should ignore statuses that are not 401 or 403", () => {
    expect(matchCredentialError(422, "slug has already been taken", oauth)).toBeUndefined();
    expect(matchCredentialError(404, "Not Found", oauth)).toBeUndefined();
    expect(matchCredentialError(500, "Internal Server Error", oauth)).toBeUndefined();
  });

  it("should emit single-line messages only", () => {
    const messages = [
      matchCredentialError(403, "Insufficient scope: stories:write is required", oauth)?.message,
      matchCredentialError(403, "This endpoint does not support this token type", pat)?.message,
      matchCredentialError(401, "Unauthorized", oauth)?.message,
      formatSpaceNotAllowedMessage(9, [1]),
    ];

    for (const message of messages) {
      expect(message).not.toContain("\n");
    }
  });
});
