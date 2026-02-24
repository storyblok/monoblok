import { describe, expect, it } from 'vitest';
import {
  createCacheKey,
  isDraftRequest,
  shouldUseCache,
} from './request';

describe('isDraftRequest', () => {
  it('should return true when version is draft', () => {
    expect(isDraftRequest({ version: 'draft' })).toBe(true);
  });

  it('should return false when version is published', () => {
    expect(isDraftRequest({ version: 'published' })).toBe(false);
  });

  it('should return false when version is absent', () => {
    expect(isDraftRequest({})).toBe(false);
  });
});

describe('createCacheKey', () => {
  it('should produce consistent key for same inputs', () => {
    const first = createCacheKey('GET', '/v2/cdn/stories', { a: 1, b: 2 });
    const second = createCacheKey('GET', '/v2/cdn/stories', { b: 2, a: 1 });

    expect(first).toBe(second);
  });

  it('should produce different keys for different methods', () => {
    const getKey = createCacheKey('GET', '/v2/cdn/stories', { a: 1 });
    const postKey = createCacheKey('POST', '/v2/cdn/stories', { a: 1 });

    expect(getKey).not.toBe(postKey);
  });

  it('should produce different keys for different paths', () => {
    const first = createCacheKey('GET', '/v2/cdn/stories', { a: 1 });
    const second = createCacheKey('GET', '/v2/cdn/links', { a: 1 });

    expect(first).not.toBe(second);
  });

  it('should handle nested objects with sorted keys', () => {
    const first = createCacheKey('GET', '/v2/cdn/stories', {
      filter_query: {
        author: {
          in: 'a,b',
        },
      },
      sort_by: 'name:asc',
    });
    const second = createCacheKey('GET', '/v2/cdn/stories', {
      sort_by: 'name:asc',
      filter_query: {
        author: {
          in: 'a,b',
        },
      },
    });

    expect(first).toBe(second);
  });
});

describe('shouldUseCache', () => {
  it('should return true for GET published request', () => {
    expect(shouldUseCache('GET', '/v2/cdn/stories', { version: 'published' })).toBe(true);
  });

  it('should return false for non-GET methods', () => {
    expect(shouldUseCache('POST', '/v2/cdn/stories', { version: 'published' })).toBe(false);
  });

  it('should return false for draft requests', () => {
    expect(shouldUseCache('GET', '/v2/cdn/stories', { version: 'draft' })).toBe(false);
  });

  it('should return false for non-cacheable paths', () => {
    expect(shouldUseCache('GET', '/v2/cdn/spaces/me', { version: 'published' })).toBe(false);
  });
});
