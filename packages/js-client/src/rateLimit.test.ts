import { describe, expect, it } from 'vitest';
import {
  createRateLimitConfig,
  determineRateLimit,
  MANAGEMENT_API_DEFAULT_RATE_LIMIT,
  parseRateLimitHeaders,
} from './rateLimit';
import { StoryblokContentVersion } from './constants';
import type { ISbStoriesParams } from './interfaces';

describe('rateLimit', () => {
  describe('createRateLimitConfig', () => {
    it('should create config with user rate limit', () => {
      const config = createRateLimitConfig(50);
      expect(config.userRateLimit).toBe(50);
      expect(config.serverHeadersRateLimit).toBeUndefined();
    });

    it('should create config without user rate limit', () => {
      const config = createRateLimitConfig();
      expect(config.userRateLimit).toBeUndefined();
      expect(config.serverHeadersRateLimit).toBeUndefined();
    });
  });

  describe('parseRateLimitHeaders', () => {
    it('should parse both X-RateLimit and X-RateLimit-Policy headers', () => {
      const headers = {
        'x-ratelimit': '"concurrent-requests";r=29',
        'x-ratelimit-policy': '"concurrent-requests";q=30',
      };
      const result = parseRateLimitHeaders(headers);
      expect(result).toEqual({
        remaining: 29,
        max: 30,
      });
    });

    it('should handle case-sensitive header names', () => {
      const headers = {
        'X-RateLimit': '"concurrent-requests";r=15',
        'X-RateLimit-Policy': '"concurrent-requests";q=50',
      };
      const result = parseRateLimitHeaders(headers);
      expect(result).toEqual({
        remaining: 15,
        max: 50,
      });
    });

    it('should parse only X-RateLimit header when present', () => {
      const headers = {
        'x-ratelimit': '"concurrent-requests";r=10',
      };
      const result = parseRateLimitHeaders(headers);
      expect(result).toEqual({
        remaining: 10,
      });
    });

    it('should parse only X-RateLimit-Policy header when present', () => {
      const headers = {
        'x-ratelimit-policy': '"concurrent-requests";q=100',
      };
      const result = parseRateLimitHeaders(headers);
      expect(result).toEqual({
        max: 100,
      });
    });

    it('should return null when no rate limit headers present', () => {
      const headers = {
        'content-type': 'application/json',
      };
      const result = parseRateLimitHeaders(headers);
      expect(result).toBeNull();
    });

    it('should return null when headers is null or undefined', () => {
      expect(parseRateLimitHeaders(null)).toBeNull();
      expect(parseRateLimitHeaders(undefined)).toBeNull();
    });

    it('should handle malformed header values', () => {
      const headers = {
        'x-ratelimit': 'invalid-format',
        'x-ratelimit-policy': 'also-invalid',
      };
      const result = parseRateLimitHeaders(headers);
      expect(result).toBeNull();
    });
  });

  describe('determineRateLimit', () => {
    describe('precedence order', () => {
      it('should prefer user rate limit over server rate limit', () => {
        const params: ISbStoriesParams = {
          version: StoryblokContentVersion.DRAFT,
        };
        const config = {
          userRateLimit: 25,
          serverHeadersRateLimit: 100,
        };
        const result = determineRateLimit('/cdn/stories', params, config);
        expect(result).toBe(25);
      });

      it('should prefer user rate limit over automatic tier calculation', () => {
        const params: ISbStoriesParams = {
          version: StoryblokContentVersion.DRAFT,
          per_page: 100, // Would normally be 6 req/s
        };
        const config = {
          userRateLimit: 20,
        };
        const result = determineRateLimit('/cdn/stories', params, config);
        expect(result).toBe(20);
      });

      it('should use server rate limit when no user rate limit provided', () => {
        const params: ISbStoriesParams = {
          version: StoryblokContentVersion.DRAFT,
        };
        const config = {
          serverHeadersRateLimit: 75,
        };
        const result = determineRateLimit('/cdn/stories', params, config);
        expect(result).toBe(75);
      });

      it('should cap any rate limit at 1000', () => {
        const params: ISbStoriesParams = {
          version: StoryblokContentVersion.DRAFT,
        };

        // User rate limit capped at 1000
        const userConfig = {
          userRateLimit: 2000,
        };
        expect(determineRateLimit('/cdn/stories', params, userConfig)).toBe(1000);

        // Server headers rate limit capped at 1000
        const serverConfig = {
          serverHeadersRateLimit: 5000,
        };
        expect(determineRateLimit('/cdn/stories', params, serverConfig)).toBe(1000);
      });
    });

    describe('cached requests', () => {
      it('should use 1000 req/s for published version when no config provided', () => {
        const params: ISbStoriesParams = {
          version: StoryblokContentVersion.PUBLISHED,
        };
        const result = determineRateLimit('/cdn/stories', params);
        expect(result).toBe(1000);
      });

      it('should use 1000 req/s when version is not specified (defaults to published)', () => {
        const params: ISbStoriesParams = {};
        const result = determineRateLimit('/cdn/stories', params);
        expect(result).toBe(1000);
      });

      it('should apply user rate limit to published version', () => {
        const params: ISbStoriesParams = {
          version: StoryblokContentVersion.PUBLISHED,
        };
        const config = {
          userRateLimit: 50,
        };
        const result = determineRateLimit('/cdn/stories', params, config);
        expect(result).toBe(50);
      });

      it('should apply server rate limit to published version when no user limit', () => {
        const params: ISbStoriesParams = {
          version: StoryblokContentVersion.PUBLISHED,
        };
        const config = {
          serverHeadersRateLimit: 75,
        };
        const result = determineRateLimit('/cdn/stories', params, config);
        expect(result).toBe(75);
      });

      it('should prefer user rate limit over default 1000 for published', () => {
        const params: ISbStoriesParams = {
          version: StoryblokContentVersion.PUBLISHED,
        };
        const config = {
          userRateLimit: 10,
          serverHeadersRateLimit: 100,
        };
        const result = determineRateLimit('/cdn/stories', params, config);
        expect(result).toBe(10);
      });
    });

    describe('server rate limit without user override', () => {
      it('should use server rate limit when provided and no user rate limit', () => {
        const params: ISbStoriesParams = {
          version: StoryblokContentVersion.DRAFT,
          per_page: 100, // Would normally be 6 req/s
        };
        const config = {
          serverHeadersRateLimit: 30,
        };
        const result = determineRateLimit('/cdn/stories', params, config);
        expect(result).toBe(30);
      });
    });

    describe('uncached requests - single stories', () => {
      it('should use 50 req/s for single story by path', () => {
        const params: ISbStoriesParams = {
          version: StoryblokContentVersion.DRAFT,
        };
        const result = determineRateLimit('/cdn/stories/home', params);
        expect(result).toBe(50);
      });

      it('should use 50 req/s for single story with find_by', () => {
        const params: ISbStoriesParams = {
          version: StoryblokContentVersion.DRAFT,
        };
        // find_by is in ISbStoryParams, not ISbStoriesParams, but the logic still applies
        const result = determineRateLimit('/cdn/stories/some-uuid', params);
        expect(result).toBe(50);
      });
    });

    describe('uncached requests - listings by per_page', () => {
      it('should use 50 req/s for listings with per_page <= 25', () => {
        const params: ISbStoriesParams = {
          version: StoryblokContentVersion.DRAFT,
          per_page: 10,
        };
        const result = determineRateLimit('/cdn/stories', params);
        expect(result).toBe(50);
      });

      it('should use 50 req/s for listings with per_page = 25', () => {
        const params: ISbStoriesParams = {
          version: StoryblokContentVersion.DRAFT,
          per_page: 25,
        };
        const result = determineRateLimit('/cdn/stories', params);
        expect(result).toBe(50);
      });

      it('should use 50 req/s for listings without per_page (defaults to 25)', () => {
        const params: ISbStoriesParams = {
          version: StoryblokContentVersion.DRAFT,
        };
        const result = determineRateLimit('/cdn/stories', params);
        expect(result).toBe(50);
      });

      it('should use 15 req/s for listings with per_page 26-50', () => {
        const params: ISbStoriesParams = {
          version: StoryblokContentVersion.DRAFT,
          per_page: 26,
        };
        const result = determineRateLimit('/cdn/stories', params);
        expect(result).toBe(15);
      });

      it('should use 15 req/s for listings with per_page = 50', () => {
        const params: ISbStoriesParams = {
          version: StoryblokContentVersion.DRAFT,
          per_page: 50,
        };
        const result = determineRateLimit('/cdn/stories', params);
        expect(result).toBe(15);
      });

      it('should use 10 req/s for listings with per_page 51-75', () => {
        const params: ISbStoriesParams = {
          version: StoryblokContentVersion.DRAFT,
          per_page: 60,
        };
        const result = determineRateLimit('/cdn/stories', params);
        expect(result).toBe(10);
      });

      it('should use 10 req/s for listings with per_page = 75', () => {
        const params: ISbStoriesParams = {
          version: StoryblokContentVersion.DRAFT,
          per_page: 75,
        };
        const result = determineRateLimit('/cdn/stories', params);
        expect(result).toBe(10);
      });

      it('should use 6 req/s for listings with per_page 76-100', () => {
        const params: ISbStoriesParams = {
          version: StoryblokContentVersion.DRAFT,
          per_page: 80,
        };
        const result = determineRateLimit('/cdn/stories', params);
        expect(result).toBe(6);
      });

      it('should use 6 req/s for listings with per_page = 100', () => {
        const params: ISbStoriesParams = {
          version: StoryblokContentVersion.DRAFT,
          per_page: 100,
        };
        const result = determineRateLimit('/cdn/stories', params);
        expect(result).toBe(6);
      });
    });
  });

  describe('management API rate limiting', () => {
    it('should use default 3 req/s when no config provided', () => {
      const result = determineRateLimit(undefined, undefined, {}, MANAGEMENT_API_DEFAULT_RATE_LIMIT);
      expect(result).toBe(MANAGEMENT_API_DEFAULT_RATE_LIMIT);
    });

    it('should use default 3 req/s for Management API with empty config', () => {
      const config = {
        isManagementApi: true,
      };
      const result = determineRateLimit(undefined, undefined, config, MANAGEMENT_API_DEFAULT_RATE_LIMIT);
      expect(result).toBe(MANAGEMENT_API_DEFAULT_RATE_LIMIT);
    });

    it('should respect user rate limit over default', () => {
      const config = {
        userRateLimit: 10,
        isManagementApi: true,
      };
      const result = determineRateLimit(undefined, undefined, config, MANAGEMENT_API_DEFAULT_RATE_LIMIT);
      expect(result).toBe(10);
    });

    it('should respect server rate limit when no user override', () => {
      const config = {
        serverHeadersRateLimit: 50,
        isManagementApi: true,
      };
      const result = determineRateLimit(undefined, undefined, config, MANAGEMENT_API_DEFAULT_RATE_LIMIT);
      expect(result).toBe(50);
    });

    it('should prioritize user rate limit over server rate limit', () => {
      const config = {
        userRateLimit: 15,
        serverHeadersRateLimit: 50,
        isManagementApi: true,
      };
      const result = determineRateLimit(undefined, undefined, config, MANAGEMENT_API_DEFAULT_RATE_LIMIT);
      expect(result).toBe(15);
    });

    it('should cap user rate limit at 1000', () => {
      const config = {
        userRateLimit: 5000,
        isManagementApi: true,
      };
      const result = determineRateLimit(undefined, undefined, config, MANAGEMENT_API_DEFAULT_RATE_LIMIT);
      expect(result).toBe(1000);
    });

    it('should cap server rate limit at 1000', () => {
      const config = {
        serverHeadersRateLimit: 2000,
        isManagementApi: true,
      };
      const result = determineRateLimit(undefined, undefined, config, MANAGEMENT_API_DEFAULT_RATE_LIMIT);
      expect(result).toBe(1000);
    });

    it('should follow precedence: user > server > default (3)', () => {
      // Only default
      expect(determineRateLimit(undefined, undefined, {}, MANAGEMENT_API_DEFAULT_RATE_LIMIT)).toBe(MANAGEMENT_API_DEFAULT_RATE_LIMIT);

      // Server override
      expect(determineRateLimit(undefined, undefined, { serverHeadersRateLimit: 25 }, MANAGEMENT_API_DEFAULT_RATE_LIMIT)).toBe(25);

      // User overrides everything
      expect(determineRateLimit(undefined, undefined, {
        userRateLimit: 10,
        serverHeadersRateLimit: 25,
      }, MANAGEMENT_API_DEFAULT_RATE_LIMIT)).toBe(10);
    });

    it('should use default rate limit of 3 for MAPI requests with params (regression test)', () => {
      // This tests the bug fix where MAPI requests with params were incorrectly
      // getting rate limit 1000 instead of 3 because they were treated as "cached" requests
      const params: ISbStoriesParams = {};
      const config = {
        isManagementApi: true,
      };

      // MAPI request with empty params should use default rate limit (3)
      const result = determineRateLimit(undefined, params, config, MANAGEMENT_API_DEFAULT_RATE_LIMIT);
      expect(result).toBe(MANAGEMENT_API_DEFAULT_RATE_LIMIT);
      expect(result).toBe(3);
    });

    it('should use default rate limit of 3 for MAPI single story request', () => {
      // Simulates: mapiClient.get(`spaces/{SPACE_ID}/stories/{STORY_ID}`)
      const url = '/spaces/123/stories/456';
      const params: ISbStoriesParams = {};
      const config = {
        isManagementApi: true,
      };

      // Should use MAPI default (3), not CDN cached rate limit (1000)
      const result = determineRateLimit(url, params, config, MANAGEMENT_API_DEFAULT_RATE_LIMIT);
      expect(result).toBe(3);
    });
  });
});
