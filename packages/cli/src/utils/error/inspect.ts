const PROMPT_CANCELLATION_NAMES = new Set([
  "ExitPromptError",
  "AbortPromptError",
  "CancelPromptError",
]);

/** User-initiated prompt cancellation (Ctrl+C or Escape in @inquirer/prompts). */
export function isPromptCancellation(error: unknown): boolean {
  return error instanceof Error && PROMPT_CANCELLATION_NAMES.has(error.name);
}

export function getResponseStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("response" in error)) {
    return undefined;
  }
  const { response } = error;
  if (typeof response !== "object" || response === null || !("status" in response)) {
    return undefined;
  }
  return typeof response.status === "number" ? response.status : undefined;
}

/** Node.js system, TLS, and undici codes, e.g. `ECONNRESET`, `CERT_HAS_EXPIRED`, `UND_ERR_SOCKET`. */
const SYSTEM_ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,40}$/;

const MAX_CAUSE_DEPTH = 5;

/**
 * `fetch` puts the code on its `TypeError`'s `cause`, and `APIError` keeps the error it wraps as
 * `error`.
 */
export function getSystemErrorCode(error: unknown): string | undefined {
  let candidate = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth++) {
    if (typeof candidate !== "object" || candidate === null) {
      return undefined;
    }
    if (
      "code" in candidate &&
      typeof candidate.code === "string" &&
      SYSTEM_ERROR_CODE_PATTERN.test(candidate.code)
    ) {
      return candidate.code;
    }
    const wrapped = "error" in candidate ? candidate.error : undefined;
    candidate = wrapped ?? ("cause" in candidate ? candidate.cause : undefined);
  }
  return undefined;
}
