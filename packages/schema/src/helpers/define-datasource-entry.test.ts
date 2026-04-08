import { describe, expect, it } from 'vitest';
import { defineDatasourceEntry } from './define-datasource-entry';

describe('defineDatasourceEntry', () => {
  it('should fill id with default when not provided', () => {
    const result = defineDatasourceEntry({ name: 'red', value: '#ff0000' });

    expect(result.id).toBe(1);
    expect(result.name).toBe('red');
    expect(result.value).toBe('#ff0000');
  });

  it('should allow overriding defaults', () => {
    const result = defineDatasourceEntry({ name: 'red', value: '#ff0000', id: 99 });

    expect(result.id).toBe(99);
  });
});
