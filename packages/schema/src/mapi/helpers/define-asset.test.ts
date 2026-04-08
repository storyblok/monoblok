import { describe, expect, it } from 'vitest';
import { defineAsset } from './define-asset';

describe('mapi/defineAsset', () => {
  it('should fill API-assigned fields with defaults when not provided', () => {
    const result = defineAsset({ filename: 'hero.png' });

    expect(result.id).toBe(1);
    expect(result.filename).toBe('hero.png');
    expect(result.space_id).toBe(1);
    expect(result.created_at).toBe('');
    expect(result.updated_at).toBe('');
    expect(result.short_filename).toBe('');
    expect(result.content_type).toBe('');
    expect(result.content_length).toBe(0);
  });

  it('should allow overriding defaults', () => {
    const result = defineAsset({ filename: 'hero.png', id: 42, content_type: 'image/png' });

    expect(result.id).toBe(42);
    expect(result.content_type).toBe('image/png');
  });
});
