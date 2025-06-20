import { describe, expect, it } from 'vitest';
import {
  createRegexFromGlob,
  maskToken,
  objectToStringParams,
  removePropertyRecursively,
  slugify,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
} from './format';

describe('format utils', () => {
  describe('toPascalCase', () => {
    it('should convert snake_case to PascalCase', () => {
      expect(toPascalCase('hello_world')).toBe('HelloWorld');
    });

    it('should handle single word', () => {
      expect(toPascalCase('hello')).toBe('Hello');
    });
  });

  describe('toCamelCase', () => {
    it('should convert snake_case to camelCase', () => {
      expect(toCamelCase('hello_world')).toBe('helloWorld');
    });

    it('should handle single word', () => {
      expect(toCamelCase('hello')).toBe('hello');
    });
  });

  describe('toSnakeCase', () => {
    it('should convert PascalCase to snake_case', () => {
      expect(toSnakeCase('HelloWorld')).toBe('hello_world');
    });

    it('should convert camelCase to snake_case', () => {
      expect(toSnakeCase('helloWorld')).toBe('hello_world');
    });
  });

  describe('maskToken', () => {
    it('should mask token longer than 4 characters', () => {
      expect(maskToken('1234567890')).toBe('1234******');
    });

    it('should not mask token with 4 or fewer characters', () => {
      expect(maskToken('1234')).toBe('1234');
      expect(maskToken('123')).toBe('123');
    });
  });

  describe('slugify', () => {
    it('should convert text to URL-friendly slug', () => {
      expect(slugify('Hello World!')).toBe('hello-world');
    });

    it('should handle special characters and multiple spaces', () => {
      expect(slugify('Hello   World!!!   Test')).toBe('hello-world-test');
    });

    it('should remove non-word characters', () => {
      expect(slugify('Hello@World#123')).toBe('helloworld123');
    });
  });

  describe('removePropertyRecursively', () => {
    it('should remove specified property from nested object', () => {
      const input = {
        name: 'test',
        id: 1,
        nested: {
          name: 'nested',
          id: 2,
          deep: {
            name: 'deep',
            id: 3,
          },
        },
      };
      const expected = {
        name: 'test',
        nested: {
          name: 'nested',
          deep: {
            name: 'deep',
          },
        },
      };
      expect(removePropertyRecursively(input, 'id')).toEqual(expected);
    });

    it('should handle arrays', () => {
      const input = {
        items: [
          { id: 1, name: 'item1' },
          { id: 2, name: 'item2' },
        ],
      };
      const expected = {
        items: [
          { name: 'item1' },
          { name: 'item2' },
        ],
      };
      expect(removePropertyRecursively(input, 'id')).toEqual(expected);
    });
  });

  describe('objectToStringParams', () => {
    it('should convert object values to strings', () => {
      const input = {
        number: 123,
        boolean: true,
        string: 'test',
        object: { key: 'value' },
        array: [1, 2, 3],
        undefined,
      };
      const expected = {
        number: '123',
        boolean: 'true',
        string: 'test',
        object: '{"key":"value"}',
        array: '[1,2,3]',
      };
      expect(objectToStringParams(input)).toEqual(expected);
    });

    it('should skip undefined values', () => {
      const input = {
        defined: 'value',
        undef: undefined,
      };
      expect(objectToStringParams(input)).toEqual({
        defined: 'value',
      });
    });
  });

  describe('createRegexFromGlob', () => {
    it('should create regex from glob pattern', () => {
      const regex = createRegexFromGlob('test*.js');
      expect(regex.test('test.js')).toBe(true);
      expect(regex.test('test123.js')).toBe(true);
      expect(regex.test('other.js')).toBe(false);
    });

    it('should escape special characters', () => {
      const regex = createRegexFromGlob('test.js');
      expect(regex.test('test.js')).toBe(true);
      expect(regex.test('testxjs')).toBe(false);
    });
  });
});
