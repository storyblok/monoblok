import { describe, expect, it } from 'vitest';
import { urlToAssetField } from './url-to-asset-field';

describe('urlToAssetField', () => {
  it('should convert a URL to an AssetField with is_external_url true', () => {
    const result = urlToAssetField('https://example.com/image.jpg');
    expect(result.fieldtype).toBe('asset');
    expect(result.filename).toBe('https://example.com/image.jpg');
    expect(result.is_external_url).toBe(true);
  });

  it('should derive name from URL last path segment', () => {
    const result = urlToAssetField('https://example.com/images/photo.jpg');
    expect(result.name).toBe('photo.jpg');
  });

  it('should apply alt option', () => {
    const result = urlToAssetField('https://example.com/image.jpg', {
      alt: 'A photo',
    });
    expect(result.alt).toBe('A photo');
  });

  it('should apply multiple options', () => {
    const result = urlToAssetField('https://example.com/image.jpg', {
      alt: 'Photo',
      title: 'My Image',
      copyright: '2024',
    });
    expect(result.alt).toBe('Photo');
    expect(result.title).toBe('My Image');
    expect(result.copyright).toBe('2024');
  });

  it('should work with non-image URLs', () => {
    const result = urlToAssetField('https://example.com/document.pdf');
    expect(result.fieldtype).toBe('asset');
    expect(result.filename).toBe('https://example.com/document.pdf');
  });

  it('should set nullable fields to null by default', () => {
    const result = urlToAssetField('https://example.com/image.jpg');
    expect(result.alt).toBeNull();
    expect(result.title).toBeNull();
    expect(result.copyright).toBeNull();
    expect(result.focus).toBeNull();
    expect(result.id).toBe(1);
  });
});
