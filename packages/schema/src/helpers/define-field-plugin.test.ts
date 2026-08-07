import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { defineFieldPlugin } from './define-field-plugin';

describe('defineFieldPlugin', () => {
  it('returns the config unchanged (identity helper)', () => {
    const value = z.object({ color: z.string() });
    const plugin = defineFieldPlugin({ fieldType: 'my-color', value });
    expect(plugin.fieldType).toBe('my-color');
    expect(plugin.value).toBe(value);
  });
});
