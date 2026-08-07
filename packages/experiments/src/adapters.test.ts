import type { ExperimentEvent } from './types';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { beaconAdapter, fetchAdapter } from './adapters';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const event: ExperimentEvent = {
  type: 'conversion',
  experiment: { id: 123, name: 'homepage_hero' },
  variant: { name: 'b', public_id: 'var_b' },
  visitorId: 'visitor-7',
  name: 'signup',
};

describe('fetchAdapter', () => {
  it('sends the event as a JSON POST to the configured url', async () => {
    let captured: { body: unknown; contentType: string | null } | undefined;
    server.use(
      http.post('https://sink.example/events', async ({ request }) => {
        captured = { body: await request.json(), contentType: request.headers.get('content-type') };
        return HttpResponse.json({ ok: true });
      }),
    );

    await fetchAdapter('https://sink.example/events')(event);

    expect(captured?.body).toEqual(event);
    expect(captured?.contentType).toContain('application/json');
  });

  it('merges custom headers', async () => {
    let auth: string | null = null;
    server.use(
      http.post('https://sink.example/events', ({ request }) => {
        auth = request.headers.get('authorization');
        return HttpResponse.json({ ok: true });
      }),
    );

    await fetchAdapter('https://sink.example/events', { headers: { authorization: 'Bearer token' } })(event);

    expect(auth).toBe('Bearer token');
  });

  it('uses an injected fetch implementation', async () => {
    const calls: string[] = [];
    const fakeFetch = (async (url: string | URL | Request) => {
      calls.push(String(url));
      return new Response(null, { status: 204 });
    }) as typeof globalThis.fetch;

    await fetchAdapter('https://sink.example/events', { fetch: fakeFetch })(event);

    expect(calls).toEqual(['https://sink.example/events']);
  });

  it('rejects on a non-2xx response', async () => {
    server.use(
      http.post('https://sink.example/events', () => new HttpResponse(null, { status: 500 })),
    );

    await expect(fetchAdapter('https://sink.example/events')(event)).rejects.toThrow(/500/);
  });

  it('throws at construction for a relative url with no base', () => {
    // Server-side `fetch` has no origin to resolve against, so a relative path
    // fails on every delivery — where `onError` swallows it. Fail loudly here.
    expect(() => fetchAdapter('/api/experiments')).toThrow(/cannot resolve/i);
  });

  it('names the offending url and the way out when it cannot resolve', () => {
    expect(() => fetchAdapter('/api/experiments')).toThrow(/\/api\/experiments/);
    expect(() => fetchAdapter('/api/experiments')).toThrow(/baseUrl/);
  });

  it('accepts any absolute url', () => {
    expect(() => fetchAdapter('https://sink.example/events')).not.toThrow();
    expect(() => fetchAdapter('http://localhost:3000/api/experiments')).not.toThrow();
  });

  it('resolves a relative url against baseUrl', async () => {
    let captured: string | undefined;
    server.use(
      http.post('https://sink.example/api/experiments', () => {
        captured = 'hit';
        return HttpResponse.json({ ok: true });
      }),
    );

    await fetchAdapter('/api/experiments', { baseUrl: 'https://sink.example/pages/home' })(event);

    expect(captured).toBe('hit');
  });

  it('ignores baseUrl when the url is already absolute', async () => {
    const calls: string[] = [];
    const fakeFetch = (async (url: string | URL | Request) => {
      calls.push(String(url));
      return new Response(null, { status: 204 });
    }) as typeof globalThis.fetch;

    await fetchAdapter('https://sink.example/events', { baseUrl: 'https://other.example', fetch: fakeFetch })(event);

    expect(calls).toEqual(['https://sink.example/events']);
  });

  it('accepts a relative url in a browser, resolving against the current page', async () => {
    // In a browser `fetch('/api/experiments')` is perfectly valid, so the
    // absolute-url requirement must not apply there.
    vi.stubGlobal('location', { href: 'https://app.example/pages/home' });
    const calls: string[] = [];
    const fakeFetch = (async (url: string | URL | Request) => {
      calls.push(String(url));
      return new Response(null, { status: 204 });
    }) as typeof globalThis.fetch;

    try {
      await fetchAdapter('/api/experiments', { fetch: fakeFetch })(event);
    }
    finally {
      vi.unstubAllGlobals();
    }

    expect(calls).toEqual(['https://app.example/api/experiments']);
  });
});

describe('beaconAdapter', () => {
  it('posts the serialized event to the url', async () => {
    const sendBeacon = vi.fn<(url: string, body: Blob) => boolean>(() => true);

    beaconAdapter('/api/experiments', { sendBeacon })(event);

    const [target, body] = sendBeacon.mock.calls[0];
    expect(target).toBe('/api/experiments');
    expect(await body.text()).toBe(JSON.stringify(event));
  });

  it('sends the payload as application/json so a JSON endpoint accepts it', () => {
    const sendBeacon = vi.fn<(url: string, body: Blob) => boolean>(() => true);

    beaconAdapter('/api/experiments', { sendBeacon })(event);

    expect(sendBeacon.mock.calls[0][1].type).toBe('application/json');
  });

  it('honors a contentType override, for a cross-origin sink avoiding a preflight', () => {
    const sendBeacon = vi.fn<(url: string, body: Blob) => boolean>(() => true);

    beaconAdapter('/api/experiments', { sendBeacon, contentType: 'text/plain' })(event);

    expect(sendBeacon.mock.calls[0][1].type).toBe('text/plain');
  });

  it('accepts a relative url', () => {
    const sendBeacon = vi.fn<(url: string, body: Blob) => boolean>(() => true);

    expect(() => beaconAdapter('/api/experiments', { sendBeacon })(event)).not.toThrow();
  });

  it('throws when the browser refuses to queue the payload', () => {
    const sendBeacon = vi.fn<(url: string, body: Blob) => boolean>(() => false);

    expect(() => beaconAdapter('/api/experiments', { sendBeacon })(event)).toThrow(/queue/i);
  });

  it('throws a clear error when sendBeacon is unavailable', () => {
    expect(() => beaconAdapter('/api/experiments', { sendBeacon: undefined })(event))
      .toThrow(/sendBeacon/);
  });

  it('returns nothing so the factory treats delivery as synchronous', () => {
    const sendBeacon = vi.fn<(url: string, body: Blob) => boolean>(() => true);

    expect(beaconAdapter('/api/experiments', { sendBeacon })(event)).toBeUndefined();
  });
});
