import { describe, expect, it } from 'vitest';
import { defineDatasourceEntry } from './define-datasource-entry';

describe('mapi/defineDatasourceEntry', () => {
  it('should fill id with default when not provided', () => {
    const result = defineDatasourceEntry({ name: 'red', datasource_id: 42 });

    expect(result.id).toBe(1);
    expect(result.name).toBe('red');
    expect(result.datasource_id).toBe(42);
  });

  it('should allow overriding defaults', () => {
    const result = defineDatasourceEntry({ name: 'red', datasource_id: 42, id: 99 });

    expect(result.id).toBe(99);
  });
});
