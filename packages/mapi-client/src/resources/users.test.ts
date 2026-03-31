import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { fromOpenApi } from '@msw/source/open-api';
import { readFileSync } from 'node:fs';
import { join } from 'pathe';
import { fileURLToPath } from 'node:url';
import { createManagementApiClient } from '../index';

const openapiSpecPath = join(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../node_modules/@storyblok/openapi/dist/mapi/users.yaml',
);
const openapiSpec = readFileSync(openapiSpecPath, 'utf-8');
const handlers = await fromOpenApi(openapiSpec);
const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('users.me()', () => {
  it('should successfully retrieve the current user', async () => {
    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.users.me();

    expect(result.error).toBeUndefined();
    expect(typeof result.data?.user).toBe('object');
  });

  it('should return error on 401', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/users/me', () => {
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }),
    );
    const client = createManagementApiClient({
      personalAccessToken: 'invalid-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.users.me();

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(401);
  });
});

describe('users.updateMe()', () => {
  it('should successfully update the current user', async () => {
    server.use(
      http.put('https://mapi.storyblok.com/v1/users/me', () => {
        return HttpResponse.json({
          user: { id: 1, email: 'updated@example.com', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-02T00:00:00Z' },
        });
      }),
    );
    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.users.updateMe({
      body: {
        user: {
          email: 'updated@example.com',
          firstname: 'Jane',
          lastname: 'Doe',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      },
    });

    expect(result.error).toBeUndefined();
    expect(result.data?.user).toBeDefined();
  });
});
