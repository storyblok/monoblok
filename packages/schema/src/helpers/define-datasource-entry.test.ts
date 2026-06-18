import { describe, expect, it } from 'vitest';
import { defineDatasourceEntry, defineMapiDatasourceEntry } from './define-datasource-entry';

describe('defineDatasourceEntry (CDN)', () => {
  it('should fill id with default when not provided', () => {
    const result = defineDatasourceEntry({ name: 'red', value: '#ff0000', dimension_value: null });

    expect(result.id).toBe(1);
    expect(result.name).toBe('red');
    expect(result.value).toBe('#ff0000');
  });

  it('should allow overriding defaults', () => {
    const result = defineDatasourceEntry({ name: 'red', value: '#ff0000', dimension_value: null, id: 99 });

    expect(result.id).toBe(99);
  });
});

describe('defineMapiDatasourceEntry', () => {
  it('should fill id with default when not provided', () => {
    const result = defineMapiDatasourceEntry({ name: 'red' });

    expect(result.id).toBe(1);
    expect(result.name).toBe('red');
  });

  it('should allow overriding defaults', () => {
    const result = defineMapiDatasourceEntry({ name: 'red', id: 99 });

    expect(result.id).toBe(99);
  });
});
