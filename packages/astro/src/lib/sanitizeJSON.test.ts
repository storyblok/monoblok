import { describe, expect, it } from 'vitest';
import { parseSanitizedJSON, sanitizeJSON } from './sanitizeJSON';

describe('sanitizeJSON', () => {
  describe('xSS Prevention', () => {
    it('should escape </script> tags to prevent script tag closure', () => {
      const malicious = {
        evil: '</script><script>alert("XSS")</script>',
      };
      const result = sanitizeJSON(malicious);

      expect(result).not.toContain('</script>');
      expect(result).toContain('\\u003c/script\\u003e');
    });

    it('should escape < and > characters', () => {
      const data = {
        html: '<div>test</div>',
        comparison: 'a < b && b > c',
      };
      const result = sanitizeJSON(data);

      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).toContain('\\u003c');
      expect(result).toContain('\\u003e');
    });

    it('should escape HTML comments', () => {
      const data = {
        comment: '<!-- malicious comment -->',
      };
      const result = sanitizeJSON(data);

      expect(result).not.toContain('<!--');
      expect(result).not.toContain('-->');
    });

    it('should prevent script injection attempts', () => {
      const attacks = [
        '</script><script>alert(1)</script>',
        '<script>alert(document.cookie)</script>',
        '"><script>alert(1)</script>',
        '<img src=x onerror=alert(1)>',
      ];

      attacks.forEach((attack) => {
        const result = sanitizeJSON({ attack });
        expect(result).not.toContain('<script');
        expect(result).not.toContain('</script');
        expect(result).not.toContain('<img');
      });
    });
  });

  describe('unicode Characters', () => {
    it('should escape line separator (U+2028)', () => {
      const data = { text: 'line1\u2028line2' };
      const result = sanitizeJSON(data);

      expect(result).toContain('\\u2028');
      expect(result).not.toContain('\u2028');
    });

    it('should escape paragraph separator (U+2029)', () => {
      const data = { text: 'para1\u2029para2' };
      const result = sanitizeJSON(data);

      expect(result).toContain('\\u2029');
      expect(result).not.toContain('\u2029');
    });

    it('should handle mixed unicode separators', () => {
      const data = {
        text: 'normal\ntext\u2028with\u2029separators',
      };
      const result = sanitizeJSON(data);

      // Normal newlines should remain
      expect(result).toContain('\\n');
      // Unicode separators should be escaped
      expect(result).toContain('\\u2028');
      expect(result).toContain('\\u2029');
    });
  });

  describe('hTML Entity Prevention', () => {
    it('should escape ampersands', () => {
      const data = {
        text: 'rock & roll',
        entity: '&lt;script&gt;',
      };
      const result = sanitizeJSON(data);

      expect(result).not.toContain('&');
      expect(result).toContain('\\u0026');
    });
  });

  describe('data Integrity', () => {
    it('should preserve normal strings', () => {
      const data = { message: 'Hello, World!' };
      const result = sanitizeJSON(data);
      const parsed = parseSanitizedJSON(result);

      expect(parsed).toEqual(data);
    });

    it('should preserve numbers', () => {
      const data = {
        int: 42,
        float: 3.14,
        negative: -10,
        zero: 0,
      };
      const result = sanitizeJSON(data);
      const parsed = parseSanitizedJSON(result);

      expect(parsed).toEqual(data);
    });

    it('should preserve booleans and null', () => {
      const data = {
        isTrue: true,
        isFalse: false,
        nothing: null,
      };
      const result = sanitizeJSON(data);
      const parsed = parseSanitizedJSON(result);

      expect(parsed).toEqual(data);
    });

    it('should preserve arrays', () => {
      const data = {
        numbers: [1, 2, 3],
        strings: ['a', 'b', 'c'],
        mixed: [1, 'two', true, null],
      };
      const result = sanitizeJSON(data);
      const parsed = parseSanitizedJSON(result);

      expect(parsed).toEqual(data);
    });

    it('should preserve nested objects', () => {
      const data = {
        user: {
          name: 'John',
          age: 30,
          address: {
            city: 'NYC',
            zip: '10001',
          },
        },
      };
      const result = sanitizeJSON(data);
      const parsed = parseSanitizedJSON(result);

      expect(parsed).toEqual(data);
    });

    it('should handle empty values', () => {
      const data = {
        emptyString: '',
        emptyArray: [],
        emptyObject: {},
      };
      const result = sanitizeJSON(data);
      const parsed = parseSanitizedJSON(result);

      expect(parsed).toEqual(data);
    });
  });

  describe('real-world Scenarios', () => {
    it('should handle user data with potentially malicious content', () => {
      const users = [
        {
          name: 'Alice</script><script>alert(1)</script>',
          bio: '<img src=x onerror=alert(1)>',
          url: 'https://example.com?a=1&b=2',
        },
        {
          name: 'Bob',
          bio: 'Normal user\u2028with unicode',
          url: 'https://test.com',
        },
      ];

      const result = sanitizeJSON({ users });
      const parsed = parseSanitizedJSON<{ users: typeof users }>(result);

      // Should parse back to original data
      expect(parsed.users).toHaveLength(2);
      expect(parsed.users[0].name).toBe('Alice</script><script>alert(1)</script>');

      // Should not contain unescaped dangerous characters
      expect(result).not.toContain('<script');
      expect(result).not.toContain('</script>');
      expect(result).not.toContain('<img');
    });

    it('should handle API response with mixed content', () => {
      const apiResponse = {
        status: 'success',
        data: {
          html: '<div class="content">Hello & goodbye</div>',
          script: 'if (a < b && b > c) { alert("test"); }',
          text: 'Line 1\u2028Line 2\u2029Line 3',
        },
        meta: {
          timestamp: Date.now(),
          version: '1.0.0',
        },
      };

      const result = sanitizeJSON(apiResponse);
      const parsed = parseSanitizedJSON(result);

      expect(parsed).toEqual(apiResponse);
      expect(result).not.toContain('<div');
      expect(result).not.toContain('&');
      expect(result).not.toContain('\u2028');
      expect(result).not.toContain('\u2029');
    });

    it('should be safe to embed in HTML script tag', () => {
      const data = {
        message: '</script><script>alert("XSS")</script>',
        html: '<div onclick="alert(1)">Click</div>',
      };

      const safeJSON = sanitizeJSON(data);

      // Simulate embedding in HTML
      const html = `<script type="application/json">${safeJSON}</script>`;

      // Should not contain actual script tags that could execute
      const scriptTagPattern = /<script(?:\s[^>]*)?>.*?<\/script>/gi;
      const matches = html.match(scriptTagPattern);

      // Should only have the wrapper script tag
      expect(matches).toHaveLength(1);
      expect(matches![0]).toContain('type="application/json"');
    });
  });

  describe('edge Cases', () => {
    it('should handle undefined input', () => {
      const result = sanitizeJSON(undefined);
      expect(result).toBe('undefined');
    });

    it('should handle functions (which become undefined in JSON)', () => {
      const data = {
        fn: () => 'test',
        value: 42,
      };
      const result = sanitizeJSON(data);
      const parsed = parseSanitizedJSON(result);

      // Functions are omitted in JSON
      expect(parsed).toEqual({ value: 42 });
    });

    it('should handle circular references gracefully', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;

      // JSON.stringify throws on circular references
      expect(() => sanitizeJSON(circular)).toThrow(TypeError);
    });

    it('should handle special number values', () => {
      const data = {
        infinity: Infinity,
        negInfinity: -Infinity,
        notANumber: Number.NaN,
      };

      const result = sanitizeJSON(data);

      // These become null in JSON
      expect(result).toContain('null');
    });
  });

  describe('performance', () => {
    it('should handle large objects efficiently', () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `User ${i}`,
        description: `<script>alert(${i})</script>`,
      }));

      const startTime = performance.now();
      const result = sanitizeJSON({ users: largeArray });
      const endTime = performance.now();

      // Should complete in reasonable time (< 100ms for 1000 items)
      expect(endTime - startTime).toBeLessThan(100);

      // Should properly sanitize all items
      expect(result).not.toContain('<script');

      // Should be parseable
      const parsed = parseSanitizedJSON<{ users: typeof largeArray }>(result);
      expect(parsed.users).toHaveLength(1000);
    });
  });
});
