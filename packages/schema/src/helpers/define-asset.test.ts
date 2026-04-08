import { describe, expect, it } from 'vitest';
import { defineAsset } from './define-asset';

describe('defineAsset', () => {
  it('should fill API-assigned fields with defaults when not provided', () => {
    const result = defineAsset({ filename: 'https://a.storyblok.com/f/1/image.png' });

    expect(result).toEqual({
      id: 1,
      space_id: 0,
      created_at: '',
      updated_at: '',
      short_filename: '',
      content_type: '',
      content_length: 0,
      filename: 'https://a.storyblok.com/f/1/image.png',
    });
  });

  it('should allow overriding defaults', () => {
    const result = defineAsset({
      filename: 'https://a.storyblok.com/f/1/image.png',
      id: 42,
      space_id: 100,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      short_filename: 'image.png',
      content_type: 'image/png',
      content_length: 1024,
    });

    expect(result).toEqual({
      id: 42,
      space_id: 100,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      short_filename: 'image.png',
      content_type: 'image/png',
      content_length: 1024,
      filename: 'https://a.storyblok.com/f/1/image.png',
    });
  });
});
