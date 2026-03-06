import { describe, expect, it } from 'vitest';
import { defineComponentCreate, defineComponentUpdate } from './define-component';

describe('mapi/defineComponentCreate', () => {
  it('should return a type safe component create payload', () => {
    const payload = {
      name: 'page',
      is_root: true,
      is_nestable: false,
    };
    const result = defineComponentCreate(payload);

    expect(result).toEqual(payload);
  });

  it('should accept minimal create payload (name only)', () => {
    const payload = { name: 'hero' };
    const result = defineComponentCreate(payload);

    expect(result).toEqual(payload);
  });
});

describe('mapi/defineComponentUpdate', () => {
  it('should return a type safe component update payload', () => {
    const payload = {
      display_name: 'Updated Page',
      is_root: false,
    };
    const result = defineComponentUpdate(payload);

    expect(result).toEqual(payload);
  });

  it('should accept empty update payload', () => {
    const payload = {};
    const result = defineComponentUpdate(payload);

    expect(result).toEqual(payload);
  });
});
