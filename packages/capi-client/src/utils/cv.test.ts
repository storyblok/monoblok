import { describe, expect, it } from 'vitest';
import { applyCvToQuery, extractCv } from './cv';

describe('extractCv', () => {
  it('should extract numeric cv from valid response', () => {
    expect(extractCv({ cv: 12_345 })).toBe(12_345);
  });

  it('should return undefined for string cv', () => {
    expect(extractCv({ cv: '12345' })).toBeUndefined();
  });

  it('should return undefined when cv is missing', () => {
    expect(extractCv({})).toBeUndefined();
  });

  it('should return undefined for non-object input', () => {
    expect(extractCv(null)).toBeUndefined();
    expect(extractCv(undefined)).toBeUndefined();
    expect(extractCv(42)).toBeUndefined();
  });
});

describe('applyCvToQuery', () => {
  it('should append cv for published request', () => {
    expect(applyCvToQuery({ version: 'published' }, 100)).toEqual({
      version: 'published',
      cv: 100,
    });
  });

  it('should not append cv for draft requests', () => {
    const query = { version: 'draft' };
    expect(applyCvToQuery(query, 100)).toBe(query);
  });

  it('should preserve user-provided cv', () => {
    expect(applyCvToQuery({ version: 'published', cv: 999 }, 100)).toEqual({
      version: 'published',
      cv: 999,
    });
  });
});
