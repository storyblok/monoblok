const PERCENT_ENCODED = /%[0-9A-F]{2}/i;

/**
 * Decodes `value` if it contains percent-encoded characters (such as `%2C` for
 * a comma), and returns it unchanged otherwise or when the encoding is
 * malformed.
 */
export function decodeIfEncoded(value: string): string {
  if (!PERCENT_ENCODED.test(value)) {
    return value;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
