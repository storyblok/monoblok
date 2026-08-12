export type CredentialKind = "oauth" | "pat" | "unknown";

/**
 * The active credential, pushed in by `program.ts`'s preAction hook so the error
 * layer can tailor remedies without importing `session.ts` (which would create an
 * import cycle through the `utils` barrel).
 *
 * `kind` stays `"unknown"` until a session is initialized. That is deliberate:
 * during `storyblok login` there is no session yet, and the login actions must keep
 * their own messages.
 */
export type CredentialContext = {
  kind: CredentialKind;
  /** Spaces the grant is restricted to, when known. Empty or absent means unrestricted. */
  spaces?: { id: number; region: string }[];
  /** The space the current command targets, when one was resolved. */
  space?: string | number;
};

const UNKNOWN_CONTEXT: CredentialContext = { kind: "unknown" };

let currentContext: CredentialContext = UNKNOWN_CONTEXT;

export function setCredentialContext(context: CredentialContext): void {
  currentContext = context;
}

export function getCredentialContext(): CredentialContext {
  return currentContext;
}

export function resetCredentialContext(): void {
  currentContext = UNKNOWN_CONTEXT;
}
