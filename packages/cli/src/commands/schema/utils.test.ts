import { join } from 'pathe';
import { describe, expect, it } from 'vitest';

import { applyDefaults, displayPath, fileTimestamp, formatValue, stripKeys } from './utils';

describe('fileTimestamp', () => {
  it('should convert an ISO timestamp to compact YYYYMMDDHHmmss form', () => {
    expect(fileTimestamp('2024-01-15T10:30:00')).toBe('20240115103000');
  });

  it('should drop milliseconds and timezone suffix', () => {
    expect(fileTimestamp('2024-01-15T10:30:00.123Z')).toBe('20240115103000');
  });

  it('should produce a filesystem-safe string', () => {
    const result = fileTimestamp('2024-01-15T10:30:00.000Z');
    expect(result).toMatch(/^\d{14}$/);
  });
});

describe('displayPath', () => {
  it('should return a path relative to CWD by default', () => {
    const filePath = join(process.cwd(), '.storyblok/migrations/12345/hero.20260430114254.js');
    expect(displayPath(filePath)).toBe('.storyblok/migrations/12345/hero.20260430114254.js');
  });

  it('should return a path relative to CWD when the user path is relative', () => {
    const filePath = join(process.cwd(), 'custom/migrations/12345/hero.js');
    expect(displayPath(filePath, 'custom')).toBe('custom/migrations/12345/hero.js');
  });

  it('should keep the absolute path when the user passed an absolute path', () => {
    const filePath = join(process.cwd(), 'storage/migrations/12345/hero.js');
    expect(displayPath(filePath, process.cwd())).toBe(filePath);
  });
});

describe('formatValue', () => {
  it('should format null and undefined as strings', () => {
    expect(formatValue(null, 0)).toBe('null');
    expect(formatValue(undefined, 0)).toBe('undefined');
  });

  it('should format strings with single quotes', () => {
    expect(formatValue('hello', 0)).toBe('\'hello\'');
  });

  it('should escape single quotes inside strings', () => {
    expect(formatValue('it\'s', 0)).toBe('\'it\\\'s\'');
  });

  it('should format numbers and booleans', () => {
    expect(formatValue(42, 0)).toBe('42');
    expect(formatValue(true, 0)).toBe('true');
    expect(formatValue(false, 0)).toBe('false');
  });

  it('should format empty arrays', () => {
    expect(formatValue([], 0)).toBe('[]');
  });

  it('should format arrays with items', () => {
    const result = formatValue(['a', 'b'], 0);
    expect(result).toBe('[\n  \'a\',\n  \'b\',\n]');
  });

  it('should format empty objects', () => {
    expect(formatValue({}, 0)).toBe('{}');
  });

  it('should format objects with sorted keys', () => {
    const result = formatValue({ z: 1, a: 2 }, 0);
    expect(result).toBe('{\n  a: 2,\n  z: 1,\n}');
  });

  it('should filter out null and undefined object values', () => {
    const result = formatValue({ a: 1, b: null, c: undefined, d: 2 }, 0);
    expect(result).toBe('{\n  a: 1,\n  d: 2,\n}');
  });

  it('should handle nested objects with correct indentation', () => {
    const result = formatValue({ outer: { inner: 'value' } }, 0);
    expect(result).toContain('outer: {\n    inner:');
  });
});

describe('stripKeys', () => {
  it('should strip specified keys', () => {
    const obj = { a: 1, b: 2, c: 3 };
    const result = stripKeys(obj, new Set(['b']));
    expect(result).toEqual({ a: 1, c: 3 });
  });

  it('should remove undefined and null values', () => {
    const obj = { a: 1, b: undefined, c: null, d: 'ok' };
    const result = stripKeys(obj, new Set());
    expect(result).toEqual({ a: 1, d: 'ok' });
  });

  it('should preserve non-stripped keys with valid values', () => {
    const obj = { keep: 'yes', strip: 'no', also_keep: 0, falsy: false };
    const result = stripKeys(obj, new Set(['strip']));
    expect(result).toEqual({ keep: 'yes', also_keep: 0, falsy: false });
  });

  it('should return empty object when all keys are stripped', () => {
    const obj = { a: 1, b: 2 };
    const result = stripKeys(obj, new Set(['a', 'b']));
    expect(result).toEqual({});
  });
});

describe('applyDefaults', () => {
  it('should inject defaults for missing fields', () => {
    const entity = { name: 'page' };
    const defaults = { internal_tag_ids: [], color: '' };
    const result = applyDefaults(entity, defaults);
    expect(result).toEqual({ name: 'page', internal_tag_ids: [], color: '' });
  });

  it('should not override existing values', () => {
    const entity = { name: 'page', internal_tag_ids: [10, 20] };
    const defaults = { internal_tag_ids: [] };
    const result = applyDefaults(entity, defaults);
    expect(result).toEqual({ name: 'page', internal_tag_ids: [10, 20] });
  });

  it('should override null and undefined with defaults', () => {
    const entity = { name: 'page', color: null, icon: undefined };
    const defaults = { color: '', icon: '' };
    const result = applyDefaults(entity, defaults);
    expect(result).toEqual({ name: 'page', color: '', icon: '' });
  });

  it('should not mutate the original entity', () => {
    const entity = { name: 'page' };
    const defaults = { internal_tag_ids: [] };
    applyDefaults(entity, defaults);
    expect(entity).toEqual({ name: 'page' });
  });
});
