import { describe, expect, it } from 'vitest';
import { defineMapiAsset } from './define-asset';

describe('defineMapiAsset', () => {
  it('should fill API-assigned fields with defaults when not provided', () => {
    const result = defineMapiAsset({ filename: 'hero.png' });

    expect(result.id).toBe(1);
    expect(result.filename).toBe('hero.png');
    expect(result.space_id).toBe(1);
    expect(result.short_filename).toBe('');
    expect(result.created_at).toBe('');
    expect(result.updated_at).toBe('');
    expect(result.content_type).toBeNull();
    expect(result.content_length).toBeNull();
  });

  it('should allow overriding defaults', () => {
    const result = defineMapiAsset({ filename: 'hero.png', id: 42, content_type: 'image/png' });

    expect(result.id).toBe(42);
    expect(result.content_type).toBe('image/png');
  });
});
