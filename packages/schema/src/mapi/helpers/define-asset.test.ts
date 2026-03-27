import { describe, expect, it } from 'vitest';
import { defineAsset, defineAssetFolder } from './define-asset';

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

describe('mapi/defineAssetFolder', () => {
  it('should fill id and uuid with defaults when not provided', () => {
    const result = defineAssetFolder({ name: 'Images' });

    expect(result.id).toBe(1);
    expect(result.uuid).toBe('');
    expect(result.name).toBe('Images');
  });

  it('should allow overriding defaults', () => {
    const result = defineAssetFolder({ name: 'Images', id: 99, uuid: 'abc-123' });

    expect(result.id).toBe(99);
    expect(result.uuid).toBe('abc-123');
  });
});
