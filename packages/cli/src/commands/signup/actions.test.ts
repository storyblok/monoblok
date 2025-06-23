import { describe, expect, it } from 'vitest';
import { buildSignupUrl } from './actions';

describe('signup actions', () => {
  describe('buildSignupUrl', () => {
    it('should build correct signup URL', () => {
      const url = buildSignupUrl();

      expect(url).toContain('https://app.storyblok.com/#/signup');
      expect(url).toContain('utm_source=storyblok-cli');
      expect(url).toContain('utm_medium=cli');
      expect(url).toContain('utm_campaign=signup');
    });

    it('should include all UTM parameters', () => {
      const url = buildSignupUrl();

      expect(url).toContain('utm_source=storyblok-cli');
      expect(url).toContain('utm_medium=cli');
      expect(url).toContain('utm_campaign=signup');
    });

    it('should use the correct Storyblok app URL', () => {
      const url = buildSignupUrl();
      expect(url.startsWith('https://app.storyblok.com/#/signup')).toBe(true);
    });
  });
});
