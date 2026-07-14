import { describe, expect, it } from 'vitest';
import { slugifyFolderPath } from './slugify-folder-path';

describe('slugifyFolderPath', () => {
  it('should slugify each segment and lowercase', () => {
    expect(slugifyFolderPath('My Layout/Heros')).toBe('my-layout/heros');
  });

  it('should canonicalize casing drift to the same value', () => {
    expect(slugifyFolderPath('Layout/Heros')).toBe(slugifyFolderPath('layout/heros'));
  });

  it('should canonicalize separator drift (spaces vs dashes) to the same value', () => {
    expect(slugifyFolderPath('My Layout')).toBe(slugifyFolderPath('my-layout'));
  });

  it('should drop empty segments and trailing slashes', () => {
    expect(slugifyFolderPath('Layout/')).toBe('layout');
    expect(slugifyFolderPath('Layout//Heros')).toBe('layout/heros');
  });

  it('should strip non-word characters and collapse dashes', () => {
    expect(slugifyFolderPath('Hero & Teaser')).toBe('hero-teaser');
  });

  it('should drop a segment that slugifies to empty (symbol-only), not leave a double slash', () => {
    expect(slugifyFolderPath('Layout/&/Heros')).toBe('layout/heros');
    expect(slugifyFolderPath('Layout/---/Heros')).toBe('layout/heros');
    expect(slugifyFolderPath('A/&/B')).toBe('a/b');
  });

  it('should return an empty string for a path with no meaningful segments', () => {
    expect(slugifyFolderPath('')).toBe('');
    expect(slugifyFolderPath('/')).toBe('');
  });
});
