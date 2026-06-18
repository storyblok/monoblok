import { describe, expect, it } from 'vitest';
import { parseFilterQuery } from './filter-query';

describe('parseFilterQuery', () => {
  it('should parse a single bracket clause into a nested object', () => {
    expect(parseFilterQuery('[highlighted][in]=true')).toEqual({
      highlighted: { in: 'true' },
    });
  });

  it('should parse multiple bracket clauses joined with &', () => {
    expect(parseFilterQuery('[highlighted][in]=true&[component][in]=hero')).toEqual({
      highlighted: { in: 'true' },
      component: { in: 'hero' },
    });
  });

  it('should merge multiple operations on the same field', () => {
    expect(parseFilterQuery('[priority][gt_int]=1&[priority][lt_int]=5')).toEqual({
      priority: { gt_int: '1', lt_int: '5' },
    });
  });

  it('should parse a JSON object string', () => {
    expect(parseFilterQuery('{"component":{"in":"hero"}}')).toEqual({
      component: { in: 'hero' },
    });
  });

  it('should return an empty object for empty input', () => {
    expect(parseFilterQuery('')).toEqual({});
    expect(parseFilterQuery('   ')).toEqual({});
  });

  it('should ignore malformed clauses without an operation', () => {
    expect(parseFilterQuery('[highlighted]=true')).toEqual({});
  });
});
