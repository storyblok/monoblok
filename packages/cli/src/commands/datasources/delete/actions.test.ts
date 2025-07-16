import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mapiClient } from '../../../api';
import { deleteDatasource } from './actions';

// MSW handlers for mocking the datasources API endpoint
const handlers = [
  http.delete('https://api.storyblok.com/v1/spaces/12345/datasources/1', async ({ request }) => {
    const token = request.headers.get('Authorization');

    // Return success response for valid token
    if (token === 'valid-token') {
      return new HttpResponse(null, { status: 204 }); // 204 No Content is standard for DELETE
    }

    // Return unauthorized error for invalid token
    return new HttpResponse('Unauthorized', { status: 401 });
  }),
];

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('delete datasources actions', () => {
  beforeEach(() => {
    // Reset and configure the MAPI client before each test
    mapiClient().dispose();
    mapiClient({
      token: 'valid-token',
      region: 'eu',
    });
  });

  describe('deleteDatasource', () => {
    it('should delete a datasource successfully', async () => {
      const result = await deleteDatasource('12345', '1');
      expect(result).toBeUndefined();
    });
    it('should throw an error if the datasource is not found by id', async () => {
      await expect(deleteDatasource('12345', 'Non-existent')).rejects.toThrow('Datasource with id \'Non-existent\' not found in space 12345.');
    });
  });
});
