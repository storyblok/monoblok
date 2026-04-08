import { describe, expect, it } from 'vitest';
import { defineTag } from './define-tag';

describe('defineTag', () => {
  it('should fill taggings_count with default when not provided', () => {
    const result = defineTag({ name: 'featured' });

    expect(result.name).toBe('featured');
    expect(result.taggings_count).toBe(0);
  });

  it('should allow overriding defaults', () => {
    const result = defineTag({ name: 'featured', taggings_count: 12 });

    expect(result.taggings_count).toBe(12);
  });
});
