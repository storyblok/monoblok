/**
 * Transforms an object's keys from camelCase to snake_case
 * @param obj - The object to transform
 * @returns A new object with snake_case keys
 */
export function camelToSnakeCase<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const transformed: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      // Convert camelCase to snake_case
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      
      // Handle nested objects and arrays
      if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
          transformed[snakeKey] = value.map(item => 
            typeof item === 'object' && item !== null ? camelToSnakeCase(item as Record<string, unknown>) : item
          );
        } else {
          transformed[snakeKey] = camelToSnakeCase(value as Record<string, unknown>);
        }
      } else {
        transformed[snakeKey] = value;
      }
    }
  }
  
  return transformed;
}

/**
 * Transforms an object's keys from snake_case to camelCase
 * @param obj - The object to transform
 * @returns A new object with camelCase keys
 */
export function snakeToCamelCase<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const transformed: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      // Convert snake_case to camelCase
      // First, remove leading and trailing underscores
      // Then, replace any sequence of underscores with a single underscore
      // Finally, convert to camelCase
      const camelKey = key
        .replace(/^_+|_+$/g, '') // Remove leading and trailing underscores
        .replace(/_+/g, '_') // Replace multiple consecutive underscores with a single one
        .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      
      // Handle nested objects and arrays
      if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
          transformed[camelKey] = value.map(item => 
            typeof item === 'object' && item !== null ? snakeToCamelCase(item as Record<string, unknown>) : item
          );
        } else {
          transformed[camelKey] = snakeToCamelCase(value as Record<string, unknown>);
        }
      } else {
        transformed[camelKey] = value;
      }
    }
  }
  
  return transformed;
} 