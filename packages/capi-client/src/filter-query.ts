// Enums for type safety and self-documentation
export enum IS {
  EMPTY_ARRAY = 'empty_array',
  NOT_EMPTY_ARRAY = 'not_empty_array',
  EMPTY = 'empty',
  NOT_EMPTY = 'not_empty',
  TRUE = 'true',
  FALSE = 'false',
  NULL = 'null',
  NOT_NULL = 'not_null'
}

// Simple filter query types
export type FilterQuery = Record<string, Record<string, string | string[] | number>>;

/**
 * Builds a Storyblok filter query from a simple object structure
 * @param filter - The filter object with nested operations
 * @returns Record of nested query parameters for the API
 */
export function buildFilterQuery(filter: FilterQuery): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = {};
  
  Object.entries(filter).forEach(([field, operations]) => {
    Object.entries(operations).forEach(([operation, value]) => {
      if (value !== undefined) {
        const paramKey = `filter_query[${field}][${operation}]`;
        params[paramKey] = Array.isArray(value) ? value.join(',') : value.toString();
      }
    });
  });
  
  return params;
}

// Field helpers for internationalization and nesting
export function i18nField(field: string, languageCode: string): string {
  const normalizedLanguageCode = languageCode.replace(/-/g, '_');
  return `${field}__i18n__${normalizedLanguageCode}`;
}

export function nestedField(field: string, index: number, property: string): string {
  return `${field}.${index}.${property}`;
}

export function nestedProperty(field: string, property: string): string {
  return `${field}.${property}`;
}
