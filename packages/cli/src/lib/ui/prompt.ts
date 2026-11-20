import { stderrPromptContext } from "./ui";

type Keypress = { name?: string; ctrl?: boolean };

export type PromptContext = typeof stderrPromptContext & { signal: AbortSignal };

/**
 * Runs an `@inquirer/prompts` prompt on stderr that Ctrl-D cancels like
 * Ctrl-C. Inquirer closes its input on Ctrl-D without settling the prompt, so
 * Node would warn about an unsettled top-level await or exit with 13.
 */
export async function promptOnStderr<T>(
  prompt: (context: PromptContext) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const onKeypress = (_text: unknown, key: Keypress | undefined) => {
    if (key?.ctrl && key.name === "d") {
      controller.abort();
    }
  };
  process.stdin.on("keypress", onKeypress);
  try {
    return await prompt({ ...stderrPromptContext, signal: controller.signal });
  } finally {
    process.stdin.off("keypress", onKeypress);
  }
}
