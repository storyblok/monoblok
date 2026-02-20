import { describe, expect, it } from 'vitest';
import {
  createCacheKey,
  isCdnPath,
  isDraftRequest,
  normalizePath,
  shouldUseCache,
  toQueryRecord,
} from './request';

describe('normalizePath', () => {
  it('returns path unchanged if starts with /', () => {
    expect(normalizePath('/v2/cdn/stories')).toBe('/v2/cdn/stories');
  });

  it('prepends / if missing', () => {
    expect(normalizePath('v2/cdn/stories')).toBe('/v2/cdn/stories');
  });
});

describe('isCdnPath', () => {
  it('returns true for CDN paths', () => {
    expect(isCdnPath('/v2/cdn/stories')).toBe(true);
  });

  it('returns false for non-CDN paths', () => {
    expect(isCdnPath('/v1/spaces')).toBe(false);
  });
});

describe('isDraftRequest', () => {
  it('returns true when version is draft', () => {
    expect(isDraftRequest({ version: 'draft' })).toBe(true);
  });

  it('returns false when version is published', () => {
    expect(isDraftRequest({ version: 'published' })).toBe(false);
  });

  it('returns false when version is absent', () => {
    expect(isDraftRequest({})).toBe(false);
  });
});

describe('createCacheKey', () => {
  it('produces consistent key for same inputs', () => {
    const first = createCacheKey('GET', '/v2/cdn/stories', { a: 1 });
    const second = createCacheKey('GET', '/v2/cdn/stories', { a: 1 });

    expect(first).toBe(second);
  });

  it('produces same key regardless of query key order', () => {
    const first = createCacheKey('GET', '/v2/cdn/stories', { a: 1, b: 2 });
    const second = createCacheKey('GET', '/v2/cdn/stories', { b: 2, a: 1 });

    expect(first).toBe(second);
  });

  it('produces different keys for different methods', () => {
    const getKey = createCacheKey('GET', '/v2/cdn/stories', { a: 1 });
    const postKey = createCacheKey('POST', '/v2/cdn/stories', { a: 1 });

    expect(getKey).not.toBe(postKey);
  });

  it('produces different keys for different paths', () => {
    const first = createCacheKey('GET', '/v2/cdn/stories', { a: 1 });
    const second = createCacheKey('GET', '/v2/cdn/links', { a: 1 });

    expect(first).not.toBe(second);
  });

  it('handles nested objects with sorted keys', () => {
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
  it('returns true for GET CDN published request', () => {
    expect(shouldUseCache('GET', '/v2/cdn/stories', { version: 'published' })).toBe(true);
  });

  it('returns false for non-GET methods', () => {
    expect(shouldUseCache('POST', '/v2/cdn/stories', { version: 'published' })).toBe(false);
  });

  it('returns false for draft requests', () => {
    expect(shouldUseCache('GET', '/v2/cdn/stories', { version: 'draft' })).toBe(false);
  });

  it('returns false for non-CDN paths', () => {
    expect(shouldUseCache('GET', '/v1/spaces', { version: 'published' })).toBe(false);
  });

  it('returns false for non-cacheable paths', () => {
    expect(shouldUseCache('GET', '/v2/cdn/spaces/me', { version: 'published' })).toBe(false);
  });
});

describe('toQueryRecord', () => {
  it('returns empty object for undefined', () => {
    expect(toQueryRecord(undefined)).toEqual({});
  });

  it('returns the object as-is when provided', () => {
    const query = { foo: 'bar' };
    expect(toQueryRecord(query)).toBe(query);
  });
});
