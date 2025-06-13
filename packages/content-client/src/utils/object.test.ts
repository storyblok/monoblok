import { describe, it, expect } from 'vitest';
import { camelToSnakeCase, snakeToCamelCase } from './object';

describe('camelToSnakeCase', () => {
  it('should transform simple camelCase keys to snake_case', () => {
    const input = {
      firstName: 'John',
      lastName: 'Doe',
      age: 30
    };
    
    const expected = {
      first_name: 'John',
      last_name: 'Doe',
      age: 30
    };
    
    expect(camelToSnakeCase(input)).toEqual(expected);
  });

  it('should handle nested objects', () => {
    const input = {
      userInfo: {
        firstName: 'John',
        lastName: 'Doe',
        contactInfo: {
          phoneNumber: '123-456-7890'
        }
      }
    };
    
    const expected = {
      user_info: {
        first_name: 'John',
        last_name: 'Doe',
        contact_info: {
          phone_number: '123-456-7890'
        }
      }
    };
    
    expect(camelToSnakeCase(input)).toEqual(expected);
  });

  it('should handle arrays of objects', () => {
    const input = {
      users: [
        { firstName: 'John', lastName: 'Doe' },
        { firstName: 'Jane', lastName: 'Smith' }
      ]
    };
    
    const expected = {
      users: [
        { first_name: 'John', last_name: 'Doe' },
        { first_name: 'Jane', last_name: 'Smith' }
      ]
    };
    
    expect(camelToSnakeCase(input)).toEqual(expected);
  });

  it('should handle undefined values', () => {
    const input = {
      firstName: 'John',
      middleName: undefined,
      lastName: 'Doe'
    };
    
    const expected = {
      first_name: 'John',
      last_name: 'Doe'
    };
    
    expect(camelToSnakeCase(input)).toEqual(expected);
  });

  it('should handle empty object', () => {
    expect(camelToSnakeCase({})).toEqual({});
  });

  it('should handle special characters in values', () => {
    const input = {
      userInfo: {
        firstName: 'John!',
        lastName: 'Doe@',
        specialChars: '!@#$%^&*()'
      }
    };
    
    const expected = {
      user_info: {
        first_name: 'John!',
        last_name: 'Doe@',
        special_chars: '!@#$%^&*()'
      }
    };
    
    expect(camelToSnakeCase(input)).toEqual(expected);
  });

  it('should handle arrays with mixed types', () => {
    const input = {
      data: [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
        { name: 'Bob', age: 35 }
      ],
      numbers: [1, 2, 3],
      strings: ['a', 'b', 'c']
    };
    
    const expected = {
      data: [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
        { name: 'Bob', age: 35 }
      ],
      numbers: [1, 2, 3],
      strings: ['a', 'b', 'c']
    };
    
    expect(camelToSnakeCase(input)).toEqual(expected);
  });

  it('should handle null values', () => {
    const input = {
      firstName: 'John',
      middleName: null,
      lastName: 'Doe'
    };
    
    const expected = {
      first_name: 'John',
      middle_name: null,
      last_name: 'Doe'
    };
    
    expect(camelToSnakeCase(input)).toEqual(expected);
  });

  it('should handle empty strings', () => {
    const input = {
      firstName: '',
      lastName: 'Doe'
    };
    
    const expected = {
      first_name: '',
      last_name: 'Doe'
    };
    
    expect(camelToSnakeCase(input)).toEqual(expected);
  });
});

describe('snakeToCamelCase', () => {
  it('should transform simple snake_case keys to camelCase', () => {
    const input = {
      first_name: 'John',
      last_name: 'Doe',
      age: 30
    };
    
    const expected = {
      firstName: 'John',
      lastName: 'Doe',
      age: 30
    };
    
    expect(snakeToCamelCase(input)).toEqual(expected);
  });

  it('should handle nested objects', () => {
    const input = {
      user_info: {
        first_name: 'John',
        last_name: 'Doe',
        contact_info: {
          phone_number: '123-456-7890'
        }
      }
    };
    
    const expected = {
      userInfo: {
        firstName: 'John',
        lastName: 'Doe',
        contactInfo: {
          phoneNumber: '123-456-7890'
        }
      }
    };
    
    expect(snakeToCamelCase(input)).toEqual(expected);
  });

  it('should handle arrays of objects', () => {
    const input = {
      users: [
        { first_name: 'John', last_name: 'Doe' },
        { first_name: 'Jane', last_name: 'Smith' }
      ]
    };
    
    const expected = {
      users: [
        { firstName: 'John', lastName: 'Doe' },
        { firstName: 'Jane', lastName: 'Smith' }
      ]
    };
    
    expect(snakeToCamelCase(input)).toEqual(expected);
  });

  it('should handle undefined values', () => {
    const input = {
      first_name: 'John',
      middle_name: undefined,
      last_name: 'Doe'
    };
    
    const expected = {
      firstName: 'John',
      lastName: 'Doe'
    };
    
    expect(snakeToCamelCase(input)).toEqual(expected);
  });

  it('should handle empty object', () => {
    expect(snakeToCamelCase({})).toEqual({});
  });

  it('should handle multiple underscores', () => {
    const input = {
      very_long_variable_name: 'test',
      multiple__underscores: 'test2'
    };
    
    const expected = {
      veryLongVariableName: 'test',
      multipleUnderscores: 'test2'
    };
    
    expect(snakeToCamelCase(input)).toEqual(expected);
  });

  it('should handle special characters in values', () => {
    const input = {
      user_info: {
        first_name: 'John!',
        last_name: 'Doe@',
        special_chars: '!@#$%^&*()'
      }
    };
    
    const expected = {
      userInfo: {
        firstName: 'John!',
        lastName: 'Doe@',
        specialChars: '!@#$%^&*()'
      }
    };
    
    expect(snakeToCamelCase(input)).toEqual(expected);
  });

  it('should handle arrays with mixed types', () => {
    const input = {
      data: [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
        { name: 'Bob', age: 35 }
      ],
      numbers: [1, 2, 3],
      strings: ['a', 'b', 'c']
    };
    
    const expected = {
      data: [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
        { name: 'Bob', age: 35 }
      ],
      numbers: [1, 2, 3],
      strings: ['a', 'b', 'c']
    };
    
    expect(snakeToCamelCase(input)).toEqual(expected);
  });

  it('should handle null values', () => {
    const input = {
      first_name: 'John',
      middle_name: null,
      last_name: 'Doe'
    };
    
    const expected = {
      firstName: 'John',
      middleName: null,
      lastName: 'Doe'
    };
    
    expect(snakeToCamelCase(input)).toEqual(expected);
  });

  it('should handle empty strings', () => {
    const input = {
      first_name: '',
      last_name: 'Doe'
    };
    
    const expected = {
      firstName: '',
      lastName: 'Doe'
    };
    
    expect(snakeToCamelCase(input)).toEqual(expected);
  });

  it('should handle consecutive underscores at the start and end', () => {
    const input = {
      '__test__': 'value',
      '_test_': 'value2'
    };
    
    const result = snakeToCamelCase(input);
    
    expect(result).toHaveProperty('test', 'value2');
    expect(Object.keys(result)).toHaveLength(1);
  });
}); 