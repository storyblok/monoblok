import { describe, expect, it } from 'vitest';
import { defineAsset } from './define-asset';

describe('defineAsset', () => {
  it('should return a type safe asset', () => {
    const asset = {
      id: 1,
      filename: 'image.png',
      space_id: 100,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      short_filename: 'image.png',
      content_type: 'image/png',
      content_length: 1024,
    };
    const result = defineAsset(asset);

    expect(result).toEqual(asset);
  });
});
