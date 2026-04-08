import { describe, expect, it } from 'vitest';
import { defineInternalTag } from './define-internal-tag';

describe('mapi/defineInternalTag', () => {
  it('should fill id with default when not provided', () => {
    const result = defineInternalTag({ name: 'hero' });

    expect(result.id).toBe(1);
    expect(result.name).toBe('hero');
  });

  it('should allow overriding defaults', () => {
    const result = defineInternalTag({ name: 'hero', id: 99 });

    expect(result.id).toBe(99);
  });
});
