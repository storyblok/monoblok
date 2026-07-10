import type { Adapter, ExperimentEvent } from './types';

export type { Adapter } from './types';

export interface FetchAdapterOptions {
  /** Override the `fetch` implementation (e.g. for testing or a custom client). */
  fetch?: typeof globalThis.fetch;
  /** Extra headers merged onto the request. */
  headers?: Record<string, string>;
}

/**
 * An adapter that POSTs each event as JSON to `url`. This is the generic sink
 * for any HTTP endpoint. For other destinations, pass your own `Adapter`
 * function to `trackEvent` instead.
 *
 * `fetch` only rejects on a network failure, so a non-2xx response is turned
 * into a thrown error to make delivery failures observable (caught by
 * `trackEvent`'s caller or `createExperiments`'s `onError`).
 */
export function fetchAdapter(url: string, options: FetchAdapterOptions = {}): Adapter {
  const { fetch = globalThis.fetch, headers } = options;
  return async (event: ExperimentEvent) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(event),
    });
    if (!response.ok) {
      throw new Error(`fetchAdapter: POST ${url} failed with ${response.status} ${response.statusText}`);
    }
    return response;
  };
}
