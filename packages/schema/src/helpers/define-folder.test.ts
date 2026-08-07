import { describe, expect, it } from 'vitest';
import { defineFolder } from './define-folder';

describe('defineFolder', () => {
  it('should compute path from the name for a root folder', () => {
    const layout = defineFolder({ name: 'Layout' });
    expect(layout).toEqual({ name: 'Layout', path: 'Layout' });
  });

  it('should compute path from the parent chain', () => {
    const layout = defineFolder({ name: 'Layout' });
    const heros = defineFolder({ name: 'Heros', parent: layout });
    expect(heros.path).toBe('Layout/Heros');
    expect(heros.parent).toBe(layout);
  });

  it('should support deep nesting', () => {
    const a = defineFolder({ name: 'A' });
    const b = defineFolder({ name: 'B', parent: a });
    const c = defineFolder({ name: 'C', parent: b });
    expect(c.path).toBe('A/B/C');
  });

  it('should throw on "/" in the folder name', () => {
    expect(() => defineFolder({ name: 'Lay/out' }))
      .toThrow('defineFolder: folder name "Lay/out" must not contain "/"');
  });

  it('should throw when the name is empty', () => {
    expect(() => defineFolder({ name: '' }))
      .toThrow('defineFolder: folder name must not be empty');
  });

  it('should throw when the name is whitespace-only', () => {
    expect(() => defineFolder({ name: '   ' }))
      .toThrow('defineFolder: folder name must not be empty');
  });
});
