import type { Options, RetryOptions } from "ky";
import type { RequestAdmission } from "../rate-limiting/request-admission";

export interface KyOptionsConfig {
  timeout: number;
  retry: RetryOptions;
  admission: RequestAdmission;
  fetch?: typeof globalThis.fetch;
}

/** Wires timeout, retries and rate limiting into the generated client's ky options. */
export function createKyOptions({ timeout, retry, admission, fetch }: KyOptionsConfig): Options {
  return {
    // Enable `throwHttpErrors` to make retry work, even if `throwOnError` is
    // `false`. The client's error handling still works because it catches
    // `HTTPError`.
    throwHttpErrors: true,
    timeout,
    // Admission waits here, before ky starts the timeout clock: a queue longer
    // than `timeout` must delay requests, not fail them.
    hooks: { beforeRequest: [admission.beforeRequest] },
    retry,
    // `globalThis.fetch` is read per call so a fetch swapped in after the
    // client was created still applies.
    fetch: admission.wrapFetch(fetch ?? ((input, init) => globalThis.fetch(input, init))),
  };
}
