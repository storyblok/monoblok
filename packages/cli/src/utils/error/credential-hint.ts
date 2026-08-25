import type { CredentialContext } from "./credential-context";

export type CredentialHint = {
  errorId: "insufficient_scope" | "forbidden" | "unauthorized";
  message: string;
  /** Credential failures are identical for every item, so bulk loops stop on the first one. */
  fatal: true;
};

// Signatures rendered by storyrails: scope_enforceable.rb and application_controller.rb.
const INSUFFICIENT_SCOPE = /^Insufficient scope: (\S+) is required$/;
const UNSUPPORTED_TOKEN_TYPE = "This endpoint does not support this token type";
const SPACE_RESTRICTED = "This token is restricted to specific spaces";
const SPACE_NOT_ALLOWED = "This token does not have access to this space";

function formatAuthorizedSpacesParenthetical(grantedSpaceIds: number[]): string {
  return grantedSpaceIds.length > 0 ? ` (authorized spaces: ${grantedSpaceIds.join(", ")})` : "";
}

/**
 * Shared by the `oauth/space-guard.ts` pre-flight check and the post-flight 403 branch,
 * so a user sees identical wording whichever one catches the problem first. OAuth only:
 * the backend's `enforce_pat_space_restriction` check runs for any scoped credential, but
 * the pre-flight guard this mirrors only ever runs for an OAuth grant (see `program.ts`).
 */
export function formatSpaceNotAllowedMessage(
  space: string | number,
  grantedSpaceIds: number[],
): string {
  return (
    `Space ${space} is not covered by your OAuth login${formatAuthorizedSpacesParenthetical(grantedSpaceIds)}. ` +
    `Re-run \`storyblok login\` and select this space at the consent screen.`
  );
}

function formatPatSpaceNotAllowedMessage(
  space: string | number,
  grantedSpaceIds: number[],
): string {
  return (
    `Space ${space} is not covered by your personal access token${formatAuthorizedSpacesParenthetical(grantedSpaceIds)}. ` +
    `Create a new token that covers this space under My account, Personal access tokens.`
  );
}

/**
 * Identifies the credential-does-not-support-this-endpoint signature, distinct from other
 * `forbidden`-classified cases (space restriction) that must still fail loudly rather than
 * degrade gracefully. See `assets/scope.ts#listLibrariesOrDegrade`.
 */
export function isUnsupportedTokenTypeServerError(serverError: string | undefined): boolean {
  return serverError === UNSUPPORTED_TOKEN_TYPE;
}

function credentialLabel(kind: CredentialContext["kind"]): string {
  return kind === "oauth" ? "Your OAuth login" : "Your personal access token";
}

export function matchCredentialError(
  status: number,
  serverError: string | undefined,
  context: CredentialContext,
): CredentialHint | undefined {
  if (context.kind === "unknown") {
    return undefined;
  }
  const isOAuth = context.kind === "oauth";

  if (status === 401) {
    return {
      errorId: "unauthorized",
      fatal: true,
      message: isOAuth
        ? "Your OAuth login is no longer valid, it may have been revoked or expired. Run `storyblok login` to sign in again."
        : "Your personal access token was rejected. It may have been revoked, create a new one and run `storyblok login --token <token>`.",
    };
  }

  if (status !== 403 || !serverError) {
    return undefined;
  }

  const missingScope = serverError.match(INSUFFICIENT_SCOPE)?.[1];
  if (missingScope) {
    return {
      errorId: "insufficient_scope",
      fatal: true,
      message: isOAuth
        ? `Your OAuth login is missing the "${missingScope}" permission. Re-run \`storyblok login\` and grant it at the consent screen.`
        : `Your personal access token is missing the "${missingScope}" scope. Create a new token with that scope under My account, Personal access tokens.`,
    };
  }

  if (serverError === UNSUPPORTED_TOKEN_TYPE) {
    return {
      errorId: "forbidden",
      fatal: true,
      message: isOAuth
        ? "This command is not available with an OAuth login yet. Re-run `storyblok login --token <token>` with a personal access token instead."
        : "This command is not available with a personal access token. Run `storyblok login` and sign in with your email and password.",
    };
  }

  if (serverError === SPACE_RESTRICTED) {
    const ids = context.spaces?.map((space) => space.id) ?? [];
    const target = ids.length > 0 ? `one of: ${ids.join(", ")}` : "<id>";
    return {
      errorId: "forbidden",
      fatal: true,
      message: `${credentialLabel(context.kind)} is limited to specific spaces. Pass --space ${ids.length > 0 ? "with " : ""}${target}.`,
    };
  }

  if (serverError === SPACE_NOT_ALLOWED) {
    const ids = context.spaces?.map((space) => space.id) ?? [];
    return {
      errorId: "forbidden",
      fatal: true,
      message: isOAuth
        ? formatSpaceNotAllowedMessage(context.space ?? "unknown", ids)
        : formatPatSpaceNotAllowedMessage(context.space ?? "unknown", ids),
    };
  }

  return undefined;
}
