import { describe, expect, it } from 'vitest';
import { defineField } from './define-field';

describe('defineField', () => {
  it('should return a type safe field', () => {
    const input = { type: 'text' as const, max_length: 100 };
    const result = defineField(input);

    expect(result).toEqual(input);
  });
});
