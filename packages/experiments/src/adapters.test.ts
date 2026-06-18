import type { ExperimentEvent } from './types';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fetchAdapter } from './adapters';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const event: ExperimentEvent = {
  type: 'conversion',
  experiment: { id: 123, name: 'homepage_hero' },
  variant: { name: 'b', public_id: 'var_b' },
  name: 'signup',
};

describe('fetchAdapter', () => {
  it('pOSTs the event as JSON to the configured url', async () => {
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
});
