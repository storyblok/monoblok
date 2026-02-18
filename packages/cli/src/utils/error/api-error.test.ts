import { describe, expect, it } from 'vitest';
import { APIError, handleAPIError } from './api-error';
import { FetchError } from '../fetch';

describe('handleAPIError', () => {
  it('should handle FetchError with 401 status', () => {
    const error = new FetchError('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(() => handleAPIError('create_story', error)).toThrow(APIError);
    try {
      handleAPIError('create_story', error);
    }
    catch (e) {
      expect(e).toBeInstanceOf(APIError);
      expect((e as APIError).code).toBe(401);
      expect((e as APIError).errorId).toBe('unauthorized');
    }
  });

  it('should handle FetchError with 422 status', () => {
    const error = new FetchError('Unprocessable', { status: 422, statusText: 'Unprocessable Entity' });

    try {
      handleAPIError('create_story', error);
    }
    catch (e) {
      expect((e as APIError).code).toBe(422);
      expect((e as APIError).errorId).toBe('unprocessable_entity');
    }
  });

  it('should handle non-FetchError objects with a response property', () => {
    const error = Object.assign(new Error('API call failed'), {
      response: { status: 422, statusText: 'Unprocessable Entity', data: { slug: ['has already been taken'] } },
    });

    try {
      handleAPIError('create_story', error);
    }
    catch (e) {
      expect(e).toBeInstanceOf(APIError);
      expect((e as APIError).code).toBe(422);
      expect((e as APIError).errorId).toBe('unprocessable_entity');
    }
  });

  it('should handle non-FetchError objects with response 404', () => {
    const error = Object.assign(new Error('Not found'), {
      response: { status: 404, statusText: 'Not Found' },
    });

    try {
      handleAPIError('create_story', error);
    }
    catch (e) {
      expect(e).toBeInstanceOf(APIError);
      expect((e as APIError).code).toBe(404);
      expect((e as APIError).errorId).toBe('not_found');
    }
  });

  it('should fall back to generic error for plain Error objects', () => {
    const error = new Error('Something broke');

    try {
      handleAPIError('create_story', error);
    }
    catch (e) {
      expect(e).toBeInstanceOf(APIError);
      expect((e as APIError).errorId).toBe('generic');
    }
  });
});
