import { describe, expect, it } from 'vitest';
import { chunk } from './array';

describe('chunk', () => {
  it('returns empty array for empty input', () => {
    expect(chunk([], 10)).toEqual([]);
  });

  it('splits a set into batches of the given size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns a single batch when input is smaller than size', () => {
    expect(chunk(['a', 'b'], 10)).toEqual([['a', 'b']]);
  });

  it('accepts a Set (any Iterable)', () => {
    expect(chunk(new Set([1, 2, 3]), 2)).toEqual([[1, 2], [3]]);
  });

  it('returns a single batch when size is 0 or negative', () => {
    expect(chunk([1, 2, 3], 0)).toEqual([[1, 2, 3]]);
    expect(chunk([1, 2, 3], -1)).toEqual([[1, 2, 3]]);
  });
});
