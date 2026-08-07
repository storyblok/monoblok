import { describe, expect, it } from 'vitest';
import { querySerializer } from './query-serializer';

const decode = (qs: string) => qs.split('&').map(decodeURIComponent).join('&');

describe('querySerializer', () => {
  it('should serialize primitives like the default', () => {
    expect(querySerializer({ per_page: 100, page: 1, starts_with: 'en/' }))
      .toBe('per_page=100&page=1&starts_with=en%2F');
  });

  it('should serialize primitive arrays as repeated params (default form)', () => {
    expect(querySerializer({ ids: ['a', 'b'] })).toBe('ids=a&ids=b');
  });

  it('should serialize a nested filter_query as bracket notation', () => {
    expect(decode(querySerializer({ filter_query: { highlighted: { in: 'true' } } })))
      .toBe('filter_query[highlighted][in]=true');
  });

  it('should serialize multiple nested fields and operations', () => {
    const result = decode(querySerializer({
      filter_query: { component: { in: 'hero' }, priority: { gt_int: 1 } },
    }));
    expect(result).toBe('filter_query[component][in]=hero&filter_query[priority][gt_int]=1');
  });

  it('should serialize __or arrays of objects with [] segments', () => {
    const result = decode(querySerializer({
      filter_query: { __or: [{ a: { is: 'true' } }, { b: { is: 'false' } }] },
    }));
    expect(result).toBe('filter_query[__or][][a][is]=true&filter_query[__or][][b][is]=false');
  });

  it('should skip undefined and null values', () => {
    expect(querySerializer({ a: undefined, b: null, c: 1 })).toBe('c=1');
  });
});
