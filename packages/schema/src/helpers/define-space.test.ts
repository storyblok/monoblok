import { describe, expect, it } from 'vitest';
import { defineSpace } from './define-space';

describe('defineSpace', () => {
  it('should fill id with default when not provided', () => {
    const result = defineSpace({ name: 'My Space', domain: 'example.com' });

    expect(result.id).toBe(1);
    expect(result.name).toBe('My Space');
    expect(result.domain).toBe('example.com');
  });

  it('should allow overriding defaults', () => {
    const result = defineSpace({ name: 'My Space', domain: 'example.com', id: 99 });

    expect(result.id).toBe(99);
  });
});
