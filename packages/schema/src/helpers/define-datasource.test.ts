import { describe, expect, it } from 'vitest';
import { defineDatasource } from './define-datasource';

describe('defineDatasource', () => {
  it('should return a type safe datasource', () => {
    const datasource = {
      id: 1,
      name: 'Colors',
      slug: 'colors',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };
    const result = defineDatasource(datasource);

    expect(result).toEqual(datasource);
  });
});
