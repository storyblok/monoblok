import { ClientError } from "@storyblok/api-client";
import { toError } from "./error";

const URL_TOKEN_PARAM = /([?&](?:token|access_token)=)[^&#\s"']+/gi;

/** Replaces the value of every `token=` / `access_token=` query parameter in `text`. */
export const redactUrlTokens = (text: string): string =>
  text.replace(URL_TOKEN_PARAM, "$1[redacted]");

/**
 * Strips the `?token=` from a `@storyblok/api-client` transport error (timeout,
 * DNS), whose message and `request` carry the full URL. HTTP errors carry none
 * and are returned as is.
 */
export function redactClientError(maybeError: unknown): Error {
  if (maybeError instanceof ClientError && maybeError.response.status > 0) {
    return maybeError;
  }
  const error = toError(maybeError);
  const redacted = new Error(redactUrlTokens(error.message));
  redacted.name = error.name;
  return redacted;
}
