import { describe, expect, it } from 'vitest';
import { applyCvToQuery, extractCv } from './cv';

describe('extractCv', () => {
  it('extracts numeric cv from valid response', () => {
    expect(extractCv({ data: { cv: 12_345 }, error: undefined })).toBe(12_345);
  });

  it('extracts cv from string value', () => {
    expect(extractCv({ data: { cv: '12345' }, error: undefined })).toBe(12_345);
  });

  it('returns undefined for error responses', () => {
    expect(extractCv({ data: { cv: 12_345 }, error: 'err' })).toBeUndefined();
  });

  it('returns undefined when data is missing', () => {
    expect(extractCv({})).toBeUndefined();
  });

  it('returns undefined for non-object input', () => {
    expect(extractCv(null)).toBeUndefined();
    expect(extractCv(undefined)).toBeUndefined();
    expect(extractCv(42)).toBeUndefined();
  });

  it('returns undefined for NaN cv string', () => {
    expect(extractCv({ data: { cv: 'not-a-number' }, error: undefined })).toBeUndefined();
  });

  it('returns undefined for Infinity cv', () => {
    expect(extractCv({ data: { cv: Infinity }, error: undefined })).toBeUndefined();
  });
});

describe('applyCvToQuery', () => {
  it('appends cv for published CDN request', () => {
    expect(applyCvToQuery('/v2/cdn/stories', { version: 'published' }, 100)).toEqual({
      version: 'published',
      cv: 100,
    });
  });

  it('does not append cv for draft requests', () => {
    const query = { version: 'draft' };
    expect(applyCvToQuery('/v2/cdn/stories', query, 100)).toBe(query);
  });

  it('does not append cv for non-CDN paths', () => {
    const query = { version: 'published' };
    expect(applyCvToQuery('/v1/spaces', query, 100)).toBe(query);
  });

  it('preserves user-provided cv', () => {
    expect(applyCvToQuery('/v2/cdn/stories', { version: 'published', cv: 999 }, 100)).toEqual({
      version: 'published',
      cv: 999,
    });
  });

  it('does not append when cv is undefined', () => {
    const query = { version: 'published' };
    expect(applyCvToQuery('/v2/cdn/stories', query, undefined)).toBe(query);
  });
});
