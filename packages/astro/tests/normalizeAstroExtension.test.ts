import { describe, expect, it } from 'vitest';
import { normalizeAstroExtension } from '../src/utils/normalizeAstroExtension';

describe('normalizeAstroExtension', () => {
  it('should return the same path if it already ends with .astro', () => {
    expect(normalizeAstroExtension('Component.astro')).toBe('Component.astro');
  });

  it('should append .astro if path does not end with .astro', () => {
    expect(normalizeAstroExtension('Component')).toBe('Component.astro');
  });

  it('should work with nested paths', () => {
    expect(normalizeAstroExtension('components/Button')).toBe(
      'components/Button.astro',
    );
  });

  it('should not double append .astro', () => {
    expect(normalizeAstroExtension('components/Card.astro')).toBe(
      'components/Card.astro',
    );
  });

  it('should handle empty string input gracefully', () => {
    expect(normalizeAstroExtension('')).toBe('.astro');
  });
});
