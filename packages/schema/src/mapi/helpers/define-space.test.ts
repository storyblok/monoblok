import { describe, expect, it } from 'vitest';
import { defineSpace } from './define-space';

describe('mapi/defineSpace', () => {
  it('should fill id with default when not provided', () => {
    const result = defineSpace({ name: 'My Space' });

    expect(result.id).toBe(1);
    expect(result.name).toBe('My Space');
  });

  it('should allow overriding defaults', () => {
    const result = defineSpace({ id: 99, name: 'My Space' });

    expect(result.id).toBe(99);
  });
});
