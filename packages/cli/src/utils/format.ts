export const toPascalCase = (str: string) => {
  return str.replace(/(?:^|_)(\w)/g, (_, char) => char.toUpperCase());
};

export const toCamelCase = (str: string) => {
  return str
    // First replace snake_case
    .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    .replace(/_/g, '')
    // Then replace kebab-case
    .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
  // Capitalize letters after special characters
    .replace(/[^a-z0-9]([a-z])/gi, (_, letter) => letter.toUpperCase())
    // Remove special characters
    .replace(/[^a-z0-9]/gi, '');
};

export const toSnakeCase = (str: string) => {
  return str
    .replace(/([A-Z])/g, (_, char) => `_${char.toLowerCase()}`)
    .replace(/^_/, '');
};

export const capitalize = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export function maskToken(token: string): string {
  // Show only the first 4 characters and replace the rest with asterisks
  if (token.length <= 4) {
    // If the token is too short, just return it as is
    return token;
  }
  const visiblePart = token.slice(0, 4);
  const maskedPart = '*'.repeat(token.length - 4);
  return `${visiblePart}${maskedPart}`;
}

export const slugify = (text: string): string =>
  text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars
    .replace(/-{2,}/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, '');

export const removePropertyRecursively = (obj: Record<string, any>, property: string): Record<string, any> => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => removePropertyRecursively(item, property));
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key !== property) {
      result[key] = removePropertyRecursively(value, property);
    }
  }
  return result;
};

/**
 * Converts an object with potential non-string values to an object with string values
 * for use with URLSearchParams
 *
 * @param obj - The object to convert
 * @returns An object with all values converted to strings
 */
export const objectToStringParams = (obj: Record<string, any>): Record<string, string> => {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    // Skip undefined values
    if (value === undefined) {
      return acc;
    }

    // Convert objects/arrays to JSON strings
    if (typeof value === 'object' && value !== null) {
      acc[key] = JSON.stringify(value);
    }
    else {
      // Convert other types to strings
      acc[key] = String(value);
    }
    return acc;
  }, {} as Record<string, string>);
};

/**
 * Creates a regex pattern from a glob pattern
 * @param pattern - The glob pattern to convert
 * @returns A regex that matches the glob pattern
 */
export function createRegexFromGlob(pattern: string): RegExp {
  // Add ^ and $ to ensure exact match, escape the pattern to handle special characters
  return new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')}$`);
}
