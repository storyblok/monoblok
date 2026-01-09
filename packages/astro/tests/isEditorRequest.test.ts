import { describe, expect, it } from 'vitest';
import { isEditorRequest } from '../src/utils/isEditorRequest';

describe('isEditorRequest', () => {
  describe('basic validation', () => {
    it('should return true when all required parameters are present', () => {
      const url = new URL('https://example.com/?_storyblok=123&_storyblok_c=456&_storyblok_tk[space_id]=789');
      expect(isEditorRequest(url)).toBe(true);
    });

    it('should return false when _storyblok parameter is missing', () => {
      const url = new URL('https://example.com/?_storyblok_c=456&_storyblok_tk[space_id]=789');
      expect(isEditorRequest(url)).toBe(false);
    });

    it('should return false when _storyblok_c parameter is missing', () => {
      const url = new URL('https://example.com/?_storyblok=123&_storyblok_tk[space_id]=789');
      expect(isEditorRequest(url)).toBe(false);
    });

    it('should return false when _storyblok_tk[space_id] parameter is missing', () => {
      const url = new URL('https://example.com/?_storyblok=123&_storyblok_c=456');
      expect(isEditorRequest(url)).toBe(false);
    });

    it('should return false when all required parameters are missing', () => {
      const url = new URL('https://example.com/');
      expect(isEditorRequest(url)).toBe(false);
    });

    it('should return false when only some parameters are present', () => {
      const url = new URL('https://example.com/?_storyblok=123');
      expect(isEditorRequest(url)).toBe(false);
    });
  });

  describe('space ID validation', () => {
    it('should return true when space ID matches the provided option', () => {
      const url = new URL('https://example.com/?_storyblok=123&_storyblok_c=456&_storyblok_tk[space_id]=789');
      expect(isEditorRequest(url, { spaceId: '789' })).toBe(true);
    });

    it('should return false when space ID does not match the provided option', () => {
      const url = new URL('https://example.com/?_storyblok=123&_storyblok_c=456&_storyblok_tk[space_id]=789');
      expect(isEditorRequest(url, { spaceId: '999' })).toBe(false);
    });

    it('should return true when space ID option is not provided', () => {
      const url = new URL('https://example.com/?_storyblok=123&_storyblok_c=456&_storyblok_tk[space_id]=789');
      expect(isEditorRequest(url, {})).toBe(true);
    });

    it('should handle numeric space IDs as strings', () => {
      const url = new URL('https://example.com/?_storyblok=123&_storyblok_c=456&_storyblok_tk[space_id]=12345');
      expect(isEditorRequest(url, { spaceId: '12345' })).toBe(true);
    });

    it('should return true when empty string space ID is provided (treated as no validation)', () => {
      const url = new URL('https://example.com/?_storyblok=123&_storyblok_c=456&_storyblok_tk[space_id]=789');
      // Empty string is falsy, so it skips the validation check
      expect(isEditorRequest(url, { spaceId: '' })).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle URLs with additional query parameters', () => {
      const url = new URL('https://example.com/?_storyblok=123&_storyblok_c=456&_storyblok_tk[space_id]=789&foo=bar&baz=qux');
      expect(isEditorRequest(url)).toBe(true);
    });

    it('should handle URLs with hash fragments', () => {
      const url = new URL('https://example.com/?_storyblok=123&_storyblok_c=456&_storyblok_tk[space_id]=789#section');
      expect(isEditorRequest(url)).toBe(true);
    });

    it('should handle URLs with paths', () => {
      const url = new URL('https://example.com/some/path/?_storyblok=123&_storyblok_c=456&_storyblok_tk[space_id]=789');
      expect(isEditorRequest(url)).toBe(true);
    });

    it('should work with different protocols', () => {
      const url = new URL('http://example.com/?_storyblok=123&_storyblok_c=456&_storyblok_tk[space_id]=789');
      expect(isEditorRequest(url)).toBe(true);
    });

    it('should handle localhost URLs', () => {
      const url = new URL('http://localhost:3000/?_storyblok=123&_storyblok_c=456&_storyblok_tk[space_id]=789');
      expect(isEditorRequest(url)).toBe(true);
    });

    it('should handle parameters with special characters in values', () => {
      const url = new URL('https://example.com/?_storyblok=abc%20def&_storyblok_c=456&_storyblok_tk[space_id]=789');
      expect(isEditorRequest(url)).toBe(true);
    });

    it('should handle empty parameter values', () => {
      const url = new URL('https://example.com/?_storyblok=&_storyblok_c=&_storyblok_tk[space_id]=789');
      expect(isEditorRequest(url)).toBe(true);
    });
  });

  describe('parameter order independence', () => {
    it('should work regardless of parameter order', () => {
      const url1 = new URL('https://example.com/?_storyblok=123&_storyblok_c=456&_storyblok_tk[space_id]=789');
      const url2 = new URL('https://example.com/?_storyblok_tk[space_id]=789&_storyblok_c=456&_storyblok=123');
      const url3 = new URL('https://example.com/?_storyblok_c=456&_storyblok_tk[space_id]=789&_storyblok=123');

      expect(isEditorRequest(url1)).toBe(true);
      expect(isEditorRequest(url2)).toBe(true);
      expect(isEditorRequest(url3)).toBe(true);
    });
  });

  describe('real-world scenarios', () => {
    it('should validate a typical Storyblok editor preview URL', () => {
      const url = new URL('https://my-site.com/blog/article-1?_storyblok=12345678&_storyblok_c=blog&_storyblok_tk[space_id]=98765&_storyblok_tk[timestamp]=1234567890');
      expect(isEditorRequest(url)).toBe(true);
    });

    it('should reject a regular page visit without editor parameters', () => {
      const url = new URL('https://my-site.com/blog/article-1');
      expect(isEditorRequest(url)).toBe(false);
    });

    it('should reject an incomplete editor request', () => {
      const url = new URL('https://my-site.com/blog/article-1?_storyblok=12345678');
      expect(isEditorRequest(url)).toBe(false);
    });

    it('should validate editor request with correct space ID and reject with wrong one', () => {
      const url = new URL('https://my-site.com/?_storyblok=123&_storyblok_c=456&_storyblok_tk[space_id]=98765');

      expect(isEditorRequest(url, { spaceId: '98765' })).toBe(true);
      expect(isEditorRequest(url, { spaceId: '12345' })).toBe(false);
    });
  });
});
