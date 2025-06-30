import { http, HttpResponse } from 'msw';

// Mock response data
const mockSpaceData = {
  id: '123',
  name: 'Test Space',
  domain: 'test-space.com',
  created_at: '2023-01-01T00:00:00.000Z',
  updated_at: '2023-01-01T00:00:00.000Z',
};

const mockErrorData = {
  error: 'Not found',
  message: 'The requested resource was not found',
};

// Base URLs for different regions
const baseUrls = {
  eu: 'https://mapi.storyblok.com/v1',
  us: 'https://mapi-us.storyblok.com/v1',
  cn: 'https://mapi.storyblokchina.cn/v1',
  ca: 'https://mapi-ca.storyblok.com/v1',
  ap: 'https://mapi-ap.storyblok.com/v1',
};

/**
 * Request handlers for different test scenarios
 */
export const handlers = [
  // Successful GET request for spaces
  http.get(`${baseUrls.eu}/spaces/123`, ({ request }) => {
    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      return HttpResponse.json(mockErrorData, { status: 401 });
    }

    return HttpResponse.json(mockSpaceData, { status: 200 });
  }),

  // POST request with custom headers
  http.post(`${baseUrls.eu}/spaces/123`, async ({ request }) => {
    const authHeader = request.headers.get('authorization');
    const customHeader = request.headers.get('custom-header');
    const contentType = request.headers.get('content-type');

    // Validate headers
    if (!authHeader || !customHeader || !contentType) {
      return HttpResponse.json(mockErrorData, { status: 400 });
    }

    try {
      const body = await request.json();
      return HttpResponse.json({ success: true, received: body }, { status: 200 });
    }
    catch {
      return HttpResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
  }),

  // US region endpoint
  http.get(`${baseUrls.us}/spaces/123`, () => {
    return HttpResponse.json(mockSpaceData, { status: 200 });
  }),

  // China region endpoint
  http.get(`${baseUrls.cn}/spaces/456`, () => {
    return HttpResponse.json({ ...mockSpaceData, id: '456' }, { status: 200 });
  }),

  // Failed request scenario
  http.get(`${baseUrls.eu}/spaces/invalid`, () => {
    return HttpResponse.json(mockErrorData, { status: 404 });
  }),

  // Non-JSON response scenario
  http.get(`${baseUrls.eu}/spaces/non-json`, () => {
    return new HttpResponse('This is not JSON', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    });
  }),

  // Empty path request
  http.get(`${baseUrls.eu}/`, () => {
    return HttpResponse.json({ message: 'API Root' }, { status: 200 });
  }),

  // Catch-all for any unhandled requests to log them
  http.all('*', ({ request }) => {
    console.warn(`Unhandled ${request.method} request to ${request.url}`);
    return HttpResponse.json(mockErrorData, { status: 404 });
  }),
];

/**
 * Error handlers for specific test scenarios
 */
export const errorHandlers = [
  // Network error simulation
  http.get(`${baseUrls.eu}/spaces/network-error`, () => {
    return HttpResponse.error();
  }),
];
