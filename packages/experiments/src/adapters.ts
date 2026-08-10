import type { Adapter, ExperimentEvent } from "./types";

export type { Adapter } from "./types";

export interface FetchAdapterOptions {
  /** Override the `fetch` implementation (e.g. for testing or a custom client). */
  fetch?: typeof globalThis.fetch;
  /** Extra headers merged onto the request. */
  headers?: Record<string, string>;
  /**
   * Base to resolve a relative `url` against, e.g. the incoming `request.url`.
   * Only needed on the server: in a browser the current page is used.
   */
  baseUrl?: string;
}

export interface BeaconAdapterOptions {
  /** Override `navigator.sendBeacon` (e.g. for testing). */
  sendBeacon?: (url: string, body: Blob) => boolean;
  /**
   * Content type the beacon is sent with. Defaults to `application/json`, which
   * matches `fetchAdapter` so one endpoint can parse both.
   *
   * `application/json` is not a CORS-safelisted content type, so a cross-origin
   * beacon is preflighted — and a preflight fired during page unload often does
   * not complete, which drops the event. For a cross-origin sink, either answer
   * `OPTIONS` on it or set this to `text/plain` and parse the body accordingly.
   */
  contentType?: string;
}

/**
 * Resolves `url` to an absolute target at construction time, so a bad URL fails
 * loudly here instead of on every delivery — where `onError` swallows it.
 *
 * A relative path resolves against `baseUrl`, or against the current page in a
 * browser. On a server there is no ambient origin, so a relative path with no
 * `baseUrl` is unresolvable and throws.
 */
function resolveTarget(url: string, baseUrl?: string): string {
  const base = baseUrl ?? globalThis.location?.href;
  try {
    return new URL(url, base).toString();
  } catch {
    throw new Error(
      `fetchAdapter: cannot resolve "${url}". Server-side fetch has no origin to resolve a relative path against — pass an absolute url, or set \`baseUrl\` to the incoming request url.`,
    );
  }
}

/**
 * An adapter that POSTs each event as JSON to `url`. This is the generic sink
 * for any HTTP endpoint. For other destinations, pass your own `Adapter`
 * function instead.
 *
 * `fetch` only rejects on a network failure, so a non-2xx response is turned
 * into a thrown error to make delivery failures observable (surfaced through
 * `createExperiments`'s `onError`).
 *
 * In a browser a relative `url` works as usual — it resolves against the
 * current page. On a server there is no ambient origin, so pass an absolute
 * url, or a relative one plus `baseUrl` (typically the incoming `request.url`).
 * Either way an unresolvable url throws here, at construction, rather than
 * failing silently on every delivery.
 *
 * That check runs eagerly, which is a behavior change from 1.x, where a relative
 * url on the server constructed fine and then failed on every delivery into
 * `onError`. Two consequences worth knowing:
 *
 * - A module-scope `fetchAdapter('/api/events')` in a module that both server and
 *   client code import now throws on the server, even when only the browser ever
 *   delivers through it. Pass `baseUrl`, use an absolute url, or build the
 *   adapter where it is used. On the client, prefer `beaconAdapter`, which takes
 *   a relative url and survives page unload.
 * - In a browser the url is resolved once, at construction, against the page that
 *   was current then. Root-relative paths (`/api/events`) are unaffected; a
 *   path-relative one (`api/events`) keeps resolving against that first page
 *   after client-side navigation.
 *
 * Pointing this at your own deployment costs an extra invocation per event; for
 * a same-deployment sink, pass a plain function as the adapter instead.
 */
export function fetchAdapter(url: string, options: FetchAdapterOptions = {}): Adapter {
  const { fetch = globalThis.fetch, headers, baseUrl } = options;
  const target = resolveTarget(url, baseUrl);
  return async (event: ExperimentEvent) => {
    const response = await fetch(target, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(event),
    });
    if (!response.ok) {
      throw new Error(
        `fetchAdapter: POST ${target} failed with ${response.status} ${response.statusText}`,
      );
    }
    return response;
  };
}

/**
 * A browser adapter that queues each event with `navigator.sendBeacon`. The
 * beacon survives page unload, so it works on a link or a form submit as well
 * as a button, where a `fetch` would be cancelled by the navigation.
 *
 * Delivery is fire-and-forget: the browser reports only whether it accepted the
 * payload for sending, not whether it arrived.
 *
 * The event is sent as a `Blob` rather than a string so the request carries
 * `content-type: application/json`, the same as `fetchAdapter`. A bare string
 * would be sent as `text/plain`, which a JSON-only endpoint rejects. See
 * `contentType` for the cross-origin caveat that comes with it.
 */
export function beaconAdapter(url: string, options: BeaconAdapterOptions = {}): Adapter {
  const { contentType = "application/json" } = options;
  return (event: ExperimentEvent): void => {
    const sendBeacon =
      options.sendBeacon ?? globalThis.navigator?.sendBeacon?.bind(globalThis.navigator);
    if (!sendBeacon) {
      throw new Error(
        "beaconAdapter: navigator.sendBeacon is unavailable. Use it in a browser, or pass `fetchAdapter` on the server.",
      );
    }
    if (!sendBeacon(url, new Blob([JSON.stringify(event)], { type: contentType }))) {
      throw new Error(
        `beaconAdapter: the browser refused to queue the event for ${url}, most likely because the payload exceeds its beacon size limit.`,
      );
    }
  };
}
