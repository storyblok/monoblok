import { describe, expect, it } from 'vitest';
import { urlToLink } from './url-to-link';

describe('urlToLink', () => {
  it('should convert a plain URL to a multilink with linktype url', () => {
    const result = urlToLink('https://example.com');
    expect(result.fieldtype).toBe('multilink');
    expect(result.linktype).toBe('url');
    expect(result.url).toBe('https://example.com');
    expect(result.cached_url).toBe('https://example.com');
  });

  it('should extract anchor from URL fragment', () => {
    const result = urlToLink('https://example.com/page#section');
    expect(result.anchor).toBe('section');
    expect(result.url).toBe('https://example.com/page');
    expect(result.cached_url).toBe('https://example.com/page');
  });

  it('should preserve query params in url and cached_url', () => {
    const result = urlToLink('https://example.com?foo=bar&baz=qux');
    expect(result.url).toBe('https://example.com?foo=bar&baz=qux');
    expect(result.cached_url).toBe('https://example.com?foo=bar&baz=qux');
  });

  it('should convert mailto: URL to email linktype', () => {
    const result = urlToLink('mailto:user@example.com');
    expect(result.linktype).toBe('email');
    expect(result.email).toBe('user@example.com');
  });

  it('should apply options target and title', () => {
    const result = urlToLink('https://example.com', {
      target: '_blank',
      title: 'My Link',
    });
    expect(result.target).toBe('_blank');
    expect(result.title).toBe('My Link');
  });

  it('should handle empty string URL', () => {
    const result = urlToLink('');
    expect(result.fieldtype).toBe('multilink');
    expect(result.linktype).toBe('url');
    expect(result.url).toBe('');
    expect(result.cached_url).toBe('');
  });
});
