import { describe, it, expect } from 'vitest';
import { serializeParams } from './url.js';

describe('serializeParams', () => {
  it('should serialize simple key-value pairs', () => {
    const params = {
      name: 'test',
      age: 25,
      active: true
    };
    expect(serializeParams(params)).toBe('name=test&age=25&active=true');
  });

  it('should handle empty object', () => {
    expect(serializeParams({})).toBe('');
  });

  it('should handle special characters', () => {
    const params = {
      query: 'hello world',
      path: '/api/v1',
      special: '!@#$%^&*()'
    };
    expect(serializeParams(params)).toBe(
      'query=hello%20world&path=%2Fapi%2Fv1&special=%21%40%23%24%25%5E%26%2A%28%29'
    );
  });

  it('should handle boolean values', () => {
    const params = {
      isActive: true,
      isDeleted: false
    };
    expect(serializeParams(params)).toBe('isActive=true&isDeleted=false');
  });

  it('should handle numeric values', () => {
    const params = {
      page: 1,
      limit: 10,
      price: 99.99
    };
    expect(serializeParams(params)).toBe('page=1&limit=10&price=99.99');
  });

  it('should filter out undefined values', () => {
    const params = {
      name: 'test',
      age: undefined
    };
    expect(serializeParams(params)).toBe('name=test');
  });

  it('should handle undefined values in the type', () => {
    const params = {
      name: 'test',
      version: undefined as string | undefined
    };
    expect(serializeParams(params)).toBe('name=test');
  });

  it('should handle arrays of values', () => {
    const params = {
      tags: ['javascript', 'typescript', 'node'],
      numbers: [1, 2, 3]
    };
    expect(serializeParams(params)).toBe(
      'tags=javascript&tags=typescript&tags=node&numbers=1&numbers=2&numbers=3'
    );
  });

  it('should handle arrays with special characters', () => {
    const params = {
      queries: ['hello world', 'test!', '(test)']
    };
    expect(serializeParams(params)).toBe(
      'queries=hello%20world&queries=test%21&queries=%28test%29'
    );
  });

  it('should handle complex nested structures', () => {
    const params = {
      filter: {
        name: 'test',
        age: 25,
        tags: ['js', 'ts']
      }
    };
    expect(serializeParams(params)).toBe(
      'filter=%5Bobject%20Object%5D'
    );
  });

  it('should handle all special characters in keys and values', () => {
    const params = {
      'key!with@special#chars': 'value!with@special#chars',
      'key(with)parentheses': 'value(with)parentheses',
      'key\'with\'quotes': 'value\'with\'quotes'
    };
    expect(serializeParams(params)).toBe(
      'key%21with%40special%23chars=value%21with%40special%23chars&key%28with%29parentheses=value%28with%29parentheses&key%27with%27quotes=value%27with%27quotes'
    );
  });

  it('should handle null values', () => {
    const params = {
      name: 'test',
      value: null
    };
    expect(serializeParams(params as any)).toBe('name=test');
  });

  it('should handle empty strings', () => {
    const params = {
      name: '',
      value: 'test'
    };
    expect(serializeParams(params)).toBe('name=&value=test');
  });

  it('should handle spaces and other whitespace characters', () => {
    const params = {
      name: 'John Doe',
      description: 'Line 1\nLine 2\tTab'
    };
    expect(serializeParams(params)).toBe(
      'name=John%20Doe&description=Line%201%0ALine%202%09Tab'
    );
  });
}); 