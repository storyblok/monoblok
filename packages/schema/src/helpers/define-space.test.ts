import { describe, expect, it } from 'vitest';
import { defineSpace } from './define-space';

describe('defineSpace', () => {
  it('should fill id, version and language_codes with defaults when not provided', () => {
    const result = defineSpace({ name: 'My Space', domain: 'example.com' });

    expect(result.id).toBe(1);
    expect(result.version).toBe(1);
    expect(result.language_codes).toEqual([]);
    expect(result.name).toBe('My Space');
    expect(result.domain).toBe('example.com');
  });

  it('should allow overriding defaults', () => {
    const result = defineSpace({ name: 'My Space', domain: 'example.com', id: 99, version: 5, language_codes: ['en', 'de'] });

    expect(result.id).toBe(99);
    expect(result.version).toBe(5);
    expect(result.language_codes).toEqual(['en', 'de']);
  });
});
