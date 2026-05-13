import { describe, expect, it } from 'vitest';
import { definePreset } from './define-preset';

describe('mapi/definePreset', () => {
  it('should fill id with default when not provided', () => {
    const result = definePreset({ name: 'Hero Dark', component_id: 42 });

    expect(result.id).toBe(1);
    expect(result.name).toBe('Hero Dark');
    expect(result.component_id).toBe(42);
  });

  it('should allow overriding defaults', () => {
    const result = definePreset({ name: 'Hero Dark', component_id: 42, id: 99 });

    expect(result.id).toBe(99);
  });
});
