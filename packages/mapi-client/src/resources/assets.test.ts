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
  '../../node_modules/@storyblok/openapi/dist/mapi/assets.yaml',
);
const openapiSpec = readFileSync(openapiSpecPath, 'utf-8');
const handlers = await fromOpenApi(openapiSpec);
const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('assets.list()', () => {
  it('should successfully retrieve multiple assets', async () => {
    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.assets.list();

    expect(result.error).toBeUndefined();
    expect(Array.isArray(result.data?.assets)).toBe(true);
  });

  it('should return error on 401', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/assets', () => {
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }),
    );
    const client = createManagementApiClient({
      personalAccessToken: 'invalid-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.assets.list();

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(401);
  });

  it('should allow overriding space_id via path option', async () => {
    let resolvedSpaceId: string | undefined;
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/assets', ({ params }) => {
        resolvedSpaceId = String(params.space_id);
        return HttpResponse.json({ assets: [] });
      }),
    );
    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.assets.list({ path: { space_id: 999 } });

    expect(result.error).toBeUndefined();
    expect(resolvedSpaceId).toBe('999');
  });
});

describe('assets.get()', () => {
  it('should successfully retrieve a single asset', async () => {
    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.assets.get(456);

    expect(result.error).toBeUndefined();
  });

  it('should return error on 401', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/assets/:asset_id', () => {
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }),
    );
    const client = createManagementApiClient({
      personalAccessToken: 'invalid-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.assets.get(456);

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(401);
  });
});

const mockSignedResponse = {
  id: '789',
  post_url: 'https://s3.example.com/upload',
  fields: {
    'key': 'assets/123/789/hero.png',
    'Content-Type': 'image/png',
    'policy': 'test-policy',
    'x-amz-credential': 'test-credential',
    'x-amz-signature': 'test-signature',
  },
};

const mockAsset = {
  id: 789,
  filename: 'https://a.storyblok.com/f/123/hero.png',
  space_id: 123,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  short_filename: 'hero.png',
  content_type: 'image/png',
  content_length: 1024,
};

describe('assets.upload()', () => {
  it('should perform the full sign -> S3 upload -> finalize -> get flow', async () => {
    const requestLog: string[] = [];
    server.use(
      http.post('https://mapi.storyblok.com/v1/spaces/:space_id/assets', () => {
        requestLog.push('sign');
        return HttpResponse.json(mockSignedResponse);
      }),
      http.post('https://s3.example.com/upload', () => {
        requestLog.push('s3-upload');
        return new HttpResponse(null, { status: 204 });
      }),
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/assets/:signed_response_object_id/finish_upload', () => {
        requestLog.push('finalize');
        return HttpResponse.json({ message: 'OK' });
      }),
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/assets/:asset_id', () => {
        requestLog.push('get');
        return HttpResponse.json(mockAsset);
      }),
    );

    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });
    const file = new Blob(['fake-png-data'], { type: 'image/png' });

    const result = await client.assets.upload({
      body: { short_filename: 'hero.png' },
      file,
    });

    expect(requestLog).toEqual(['sign', 's3-upload', 'finalize', 'get']);
    expect(result.id).toBe(789);
    expect(result.short_filename).toBe('hero.png');
    expect(result.filename).toBe('https://a.storyblok.com/f/123/hero.png');
  });

  it('should send the correct sign request body', async () => {
    let capturedSignBody: Record<string, unknown> | undefined;
    server.use(
      http.post('https://mapi.storyblok.com/v1/spaces/:space_id/assets', async ({ request }) => {
        capturedSignBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json(mockSignedResponse);
      }),
      http.post('https://s3.example.com/upload', () => {
        return new HttpResponse(null, { status: 204 });
      }),
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/assets/:signed_response_object_id/finish_upload', () => {
        return HttpResponse.json({ message: 'OK' });
      }),
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/assets/:asset_id', () => {
        return HttpResponse.json(mockAsset);
      }),
    );

    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });
    const file = new Blob(['fake-png-data'], { type: 'image/png' });

    await client.assets.upload({
      body: { short_filename: 'hero.png', asset_folder_id: 42, is_private: true },
      file,
    });

    expect(capturedSignBody).toEqual({
      filename: 'hero.png',
      asset_folder_id: 42,
      is_private: true,
    });
  });

  it('should include signed fields in the S3 FormData upload', async () => {
    let capturedFormData: FormData | undefined;
    server.use(
      http.post('https://mapi.storyblok.com/v1/spaces/:space_id/assets', () => {
        return HttpResponse.json(mockSignedResponse);
      }),
      http.post('https://s3.example.com/upload', async ({ request }) => {
        capturedFormData = await request.formData();
        return new HttpResponse(null, { status: 204 });
      }),
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/assets/:signed_response_object_id/finish_upload', () => {
        return HttpResponse.json({ message: 'OK' });
      }),
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/assets/:asset_id', () => {
        return HttpResponse.json(mockAsset);
      }),
    );

    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });
    const file = new Blob(['fake-png-data'], { type: 'image/png' });

    await client.assets.upload({
      body: { short_filename: 'hero.png' },
      file,
    });

    expect(capturedFormData).toBeDefined();
    expect(capturedFormData!.get('key')).toBe('assets/123/789/hero.png');
    expect(capturedFormData!.get('Content-Type')).toBe('image/png');
    expect(capturedFormData!.get('policy')).toBe('test-policy');
    const uploadedFile = capturedFormData!.get('file') as File;
    expect(uploadedFile).toBeInstanceOf(File);
    expect(uploadedFile.name).toBe('hero.png');
  });

  it('should call finalize with the correct signed_response_object_id', async () => {
    let capturedFinalizeId: string | undefined;
    server.use(
      http.post('https://mapi.storyblok.com/v1/spaces/:space_id/assets', () => {
        return HttpResponse.json(mockSignedResponse);
      }),
      http.post('https://s3.example.com/upload', () => {
        return new HttpResponse(null, { status: 204 });
      }),
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/assets/:signed_response_object_id/finish_upload', ({ params }) => {
        capturedFinalizeId = String(params.signed_response_object_id);
        return HttpResponse.json({ message: 'OK' });
      }),
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/assets/:asset_id', () => {
        return HttpResponse.json(mockAsset);
      }),
    );

    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });
    const file = new Blob(['fake-png-data'], { type: 'image/png' });

    await client.assets.upload({
      body: { short_filename: 'hero.png' },
      file,
    });

    expect(capturedFinalizeId).toBe('789');
  });

  it('should throw when S3 upload fails', async () => {
    server.use(
      http.post('https://mapi.storyblok.com/v1/spaces/:space_id/assets', () => {
        return HttpResponse.json(mockSignedResponse);
      }),
      http.post('https://s3.example.com/upload', () => {
        return new HttpResponse(null, { status: 403, statusText: 'Forbidden' });
      }),
    );

    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });
    const file = new Blob(['fake-png-data'], { type: 'image/png' });

    await expect(
      client.assets.upload({ body: { short_filename: 'hero.png' }, file }),
    ).rejects.toThrow('Failed to upload asset to S3');
  });

  it('should throw when sign response has no id', async () => {
    server.use(
      http.post('https://mapi.storyblok.com/v1/spaces/:space_id/assets', () => {
        return HttpResponse.json({ post_url: 'https://s3.example.com/upload', fields: {} });
      }),
    );

    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });
    const file = new Blob(['fake-png-data'], { type: 'image/png' });

    await expect(
      client.assets.upload({ body: { short_filename: 'hero.png' }, file }),
    ).rejects.toThrow('Invalid signed response: missing id');
  });
});

describe('assets.create()', () => {
  it('should upload and return asset when no metadata is provided', async () => {
    const requestLog: string[] = [];
    server.use(
      http.post('https://mapi.storyblok.com/v1/spaces/:space_id/assets', () => {
        requestLog.push('sign');
        return HttpResponse.json(mockSignedResponse);
      }),
      http.post('https://s3.example.com/upload', () => {
        requestLog.push('s3-upload');
        return new HttpResponse(null, { status: 204 });
      }),
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/assets/:signed_response_object_id/finish_upload', () => {
        requestLog.push('finalize');
        return HttpResponse.json({ message: 'OK' });
      }),
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/assets/:asset_id', () => {
        requestLog.push('get');
        return HttpResponse.json(mockAsset);
      }),
    );

    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });
    const file = new Blob(['fake-png-data'], { type: 'image/png' });

    const result = await client.assets.create({
      body: { short_filename: 'hero.png' },
      file,
    });

    expect(requestLog).toEqual(['sign', 's3-upload', 'finalize', 'get']);
    expect(result.id).toBe(789);
  });

  it('should upload then update metadata when metadata fields are provided', async () => {
    const requestLog: string[] = [];
    let capturedUpdateBody: Record<string, unknown> | undefined;

    const updatedAsset = { ...mockAsset, alt: 'A hero image', title: 'Hero' };

    server.use(
      http.post('https://mapi.storyblok.com/v1/spaces/:space_id/assets', ({ request }) => {
        if (request.method === 'POST') {
          requestLog.push('sign');
        }
        return HttpResponse.json(mockSignedResponse);
      }),
      http.post('https://s3.example.com/upload', () => {
        requestLog.push('s3-upload');
        return new HttpResponse(null, { status: 204 });
      }),
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/assets/:signed_response_object_id/finish_upload', () => {
        requestLog.push('finalize');
        return HttpResponse.json({ message: 'OK' });
      }),
      http.put('https://mapi.storyblok.com/v1/spaces/:space_id/assets/:asset_id', async ({ request }) => {
        requestLog.push('update');
        capturedUpdateBody = await request.json() as Record<string, unknown>;
        return new HttpResponse(null, { status: 204 });
      }),
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/assets/:asset_id', () => {
        requestLog.push('get');
        return HttpResponse.json(updatedAsset);
      }),
    );

    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });
    const file = new Blob(['fake-png-data'], { type: 'image/png' });

    const result = await client.assets.create({
      body: { short_filename: 'hero.png', alt: 'A hero image', title: 'Hero' },
      file,
    });

    expect(requestLog).toEqual(['sign', 's3-upload', 'finalize', 'get', 'update', 'get']);
    expect(capturedUpdateBody).toEqual({ asset: { alt: 'A hero image', title: 'Hero' } });
    expect(result.alt).toBe('A hero image');
    expect(result.title).toBe('Hero');
  });

  it('should pass upload-only fields to sign and exclude them from metadata update', async () => {
    let capturedSignBody: Record<string, unknown> | undefined;
    let capturedUpdateBody: Record<string, unknown> | undefined;

    server.use(
      http.post('https://mapi.storyblok.com/v1/spaces/:space_id/assets', async ({ request }) => {
        capturedSignBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json(mockSignedResponse);
      }),
      http.post('https://s3.example.com/upload', () => {
        return new HttpResponse(null, { status: 204 });
      }),
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/assets/:signed_response_object_id/finish_upload', () => {
        return HttpResponse.json({ message: 'OK' });
      }),
      http.put('https://mapi.storyblok.com/v1/spaces/:space_id/assets/:asset_id', async ({ request }) => {
        capturedUpdateBody = await request.json() as Record<string, unknown>;
        return new HttpResponse(null, { status: 204 });
      }),
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/assets/:asset_id', () => {
        return HttpResponse.json(mockAsset);
      }),
    );

    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });
    const file = new Blob(['fake-png-data'], { type: 'image/png' });

    await client.assets.create({
      body: {
        short_filename: 'hero.png',
        asset_folder_id: 42,
        is_private: true,
        alt: 'Hero image',
      },
      file,
    });

    expect(capturedSignBody).toEqual({
      filename: 'hero.png',
      asset_folder_id: 42,
      is_private: true,
    });
    expect(capturedUpdateBody).toEqual({ asset: { alt: 'Hero image' } });
  });
});

describe('assets.update() with file replacement', () => {
  it('should perform sign -> S3 upload -> finalize for file replacement', async () => {
    const requestLog: string[] = [];
    let capturedSignBody: Record<string, unknown> | undefined;

    server.use(
      http.post('https://mapi.storyblok.com/v1/spaces/:space_id/assets', async ({ request }) => {
        requestLog.push('sign');
        capturedSignBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json(mockSignedResponse);
      }),
      http.post('https://s3.example.com/upload', () => {
        requestLog.push('s3-upload');
        return new HttpResponse(null, { status: 204 });
      }),
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/assets/:signed_response_object_id/finish_upload', () => {
        requestLog.push('finalize');
        return HttpResponse.json({ message: 'OK' });
      }),
    );

    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });
    const file = new Blob(['new-png-data'], { type: 'image/png' });

    await client.assets.update(789, {
      body: { short_filename: 'hero-v2.png', asset: {} },
      file,
    });

    expect(requestLog).toEqual(['sign', 's3-upload', 'finalize']);
    expect(capturedSignBody).toEqual({
      filename: 'hero-v2.png',
      id: 789,
    });
  });

  it('should replace file and update metadata when both are provided', async () => {
    const requestLog: string[] = [];
    let capturedUpdateBody: Record<string, unknown> | undefined;

    server.use(
      http.post('https://mapi.storyblok.com/v1/spaces/:space_id/assets', () => {
        requestLog.push('sign');
        return HttpResponse.json(mockSignedResponse);
      }),
      http.post('https://s3.example.com/upload', () => {
        requestLog.push('s3-upload');
        return new HttpResponse(null, { status: 204 });
      }),
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/assets/:signed_response_object_id/finish_upload', () => {
        requestLog.push('finalize');
        return HttpResponse.json({ message: 'OK' });
      }),
      http.put('https://mapi.storyblok.com/v1/spaces/:space_id/assets/:asset_id', async ({ request }) => {
        requestLog.push('update');
        capturedUpdateBody = await request.json() as Record<string, unknown>;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });
    const file = new Blob(['new-png-data'], { type: 'image/png' });

    await client.assets.update(789, {
      body: {
        short_filename: 'hero-v2.png',
        asset: { alt: 'Updated hero', title: 'Hero V2' },
      },
      file,
    });

    expect(requestLog).toEqual(['sign', 's3-upload', 'finalize', 'update']);
    expect(capturedUpdateBody).toEqual({
      asset: { alt: 'Updated hero', title: 'Hero V2' },
    });
  });

  it('should skip metadata update when asset body is empty', async () => {
    const requestLog: string[] = [];

    server.use(
      http.post('https://mapi.storyblok.com/v1/spaces/:space_id/assets', () => {
        requestLog.push('sign');
        return HttpResponse.json(mockSignedResponse);
      }),
      http.post('https://s3.example.com/upload', () => {
        requestLog.push('s3-upload');
        return new HttpResponse(null, { status: 204 });
      }),
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/assets/:signed_response_object_id/finish_upload', () => {
        requestLog.push('finalize');
        return HttpResponse.json({ message: 'OK' });
      }),
      http.put('https://mapi.storyblok.com/v1/spaces/:space_id/assets/:asset_id', () => {
        requestLog.push('update');
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });
    const file = new Blob(['new-png-data'], { type: 'image/png' });

    await client.assets.update(789, {
      body: { short_filename: 'hero-v2.png', asset: {} },
      file,
    });

    expect(requestLog).toEqual(['sign', 's3-upload', 'finalize']);
    expect(requestLog).not.toContain('update');
  });

  it('should throw when S3 upload fails during file replacement', async () => {
    server.use(
      http.post('https://mapi.storyblok.com/v1/spaces/:space_id/assets', () => {
        return HttpResponse.json(mockSignedResponse);
      }),
      http.post('https://s3.example.com/upload', () => {
        return new HttpResponse(null, { status: 403, statusText: 'Forbidden' });
      }),
    );

    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });
    const file = new Blob(['new-png-data'], { type: 'image/png' });

    await expect(
      client.assets.update(789, {
        body: { short_filename: 'hero-v2.png', asset: {} },
        file,
      }),
    ).rejects.toThrow('Failed to upload asset to S3');
  });
});
