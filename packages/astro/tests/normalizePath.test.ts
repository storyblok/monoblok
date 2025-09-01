import { describe, expect, it } from 'vitest';
import { normalizePath } from '../src/utils/normalizePath';

describe('normalizePath', () => {
  it('should add leading slash if missing', () => {
    expect(normalizePath('components')).toBe('/components');
  });

  it('should preserve leading slash if already present', () => {
    expect(normalizePath('/components')).toBe('/components');
  });

  it('should remove trailing slash', () => {
    expect(normalizePath('/components/')).toBe('/components');
  });

  it('should collapse duplicate slashes', () => {
    expect(normalizePath('//foo//bar///baz')).toBe('/foo/bar/baz');
  });

  it('should return root slash for input \'/\'', () => {
    expect(normalizePath('/')).toBe('/');
  });

  it('should handle empty string', () => {
    expect(normalizePath('')).toBe('/');
  });

  it('should trim whitespace around the path', () => {
    expect(normalizePath('  /components/ ')).toBe('/components');
  });
  it('should normalize relative paths like \'../shared\'', () => {
    expect(normalizePath('../shared')).toBe('/../shared');
  });

  it('should preserve file extensions like \'.astro\'', () => {
    expect(normalizePath('/components/Test.astro')).toBe(
      '/components/Test.astro',
    );
  });
});
