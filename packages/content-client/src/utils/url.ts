/**
 * Serializes parameters into a URL query string
 * @param params - The parameters to serialize
 * @returns A properly formatted query string
 */
export function serializeParams(params: Record<string, string | number | boolean | undefined | Array<string | number | boolean> | Record<string, unknown>>): string {
  return Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null)
    .map(([key, value]) => {
      // Helper function to encode special characters
      const encodeSpecialChars = (str: string): string => {
        return encodeURIComponent(str)
          .replace(/!/g, '%21')
          .replace(/'/g, '%27')
          .replace(/\(/g, '%28')
          .replace(/\)/g, '%29')
          .replace(/\*/g, '%2A');
      };

      if (Array.isArray(value)) {
        return value.map(item => `${encodeSpecialChars(key)}=${encodeSpecialChars(String(item))}`).join('&');
      }
      if (value && typeof value === 'object') {
        // Handle nested objects by converting them to string
        return `${encodeSpecialChars(key)}=${encodeSpecialChars(String(value))}`;
      }
      return `${encodeSpecialChars(key)}=${encodeSpecialChars(String(value))}`;
    })
    .join('&');
} 