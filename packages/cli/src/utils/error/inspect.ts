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
