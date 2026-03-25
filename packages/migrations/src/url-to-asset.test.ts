import { describe, expect, it } from 'vitest';
import { urlToAsset } from './url-to-asset';

describe('urlToAsset', () => {
  it('should convert a URL to an Asset with the filename set', () => {
    const result = urlToAsset('https://example.com/image.jpg');
    expect(result.filename).toBe('https://example.com/image.jpg');
  });

  it('should derive short_filename from URL last path segment', () => {
    const result = urlToAsset('https://example.com/images/photo.jpg');
    expect(result.short_filename).toBe('photo.jpg');
  });

  it('should apply alt option', () => {
    const result = urlToAsset('https://example.com/image.jpg', {
      alt: 'A photo',
    });
    expect(result.alt).toBe('A photo');
  });

  it('should apply multiple options', () => {
    const result = urlToAsset('https://example.com/image.jpg', {
      alt: 'Photo',
      title: 'My Image',
      copyright: '2024',
    });
    expect(result.alt).toBe('Photo');
    expect(result.title).toBe('My Image');
    expect(result.copyright).toBe('2024');
  });

  it('should work with non-image URLs', () => {
    const result = urlToAsset('https://example.com/document.pdf');
    expect(result.filename).toBe('https://example.com/document.pdf');
  });

  it('should set id to 0 and is_private to false by default', () => {
    const result = urlToAsset('https://example.com/image.jpg');
    expect(result.id).toBe(0);
    expect(result.is_private).toBe(false);
  });
});
