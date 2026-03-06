import { describe, expect, it } from 'vitest';
import { defineDatasourceCreate, defineDatasourceUpdate } from './define-datasource';

describe('mapi/defineDatasourceCreate', () => {
  it('should return a type safe datasource create payload', () => {
    const payload = {
      name: 'Colors',
      slug: 'colors',
    };
    const result = defineDatasourceCreate(payload);

    expect(result).toEqual(payload);
  });

  it('should accept create payload with dimensions', () => {
    const payload = {
      name: 'Colors',
      slug: 'colors',
      dimensions_attributes: [
        { name: 'de', entry_value: 'de' },
      ],
    };
    const result = defineDatasourceCreate(payload);

    expect(result).toEqual(payload);
  });
});

describe('mapi/defineDatasourceUpdate', () => {
  it('should return a type safe datasource update payload', () => {
    const payload = { name: 'Updated Colors' };
    const result = defineDatasourceUpdate(payload);

    expect(result).toEqual(payload);
  });

  it('should accept empty update payload', () => {
    const payload = {};
    const result = defineDatasourceUpdate(payload);

    expect(result).toEqual(payload);
  });
});
