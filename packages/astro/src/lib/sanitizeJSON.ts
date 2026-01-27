/**
 * Safely serializes data to JSON and escapes characters that could break out of a script tag
 * or execute malicious code when embedded in HTML.
 *
 * This prevents XSS attacks by escaping:
 * - `</script>` tags that could close the script tag early
 * - `<!--` and `-->` HTML comment sequences
 * - Line separator (U+2028) and paragraph separator (U+2029) which are valid JSON but can break JS
 * - Other potentially dangerous Unicode characters
 *
 * @param data - The data to serialize
 * @returns A safe JSON string that can be embedded in HTML
 *
 * @example
 * ```ts
 * const safeJSON = sanitizeJSON({
 *   message: '</script><script>alert("XSS")</script>'
 * });
 * // Returns escaped version that won't execute
 * ```
 */
export function sanitizeJSON(data: unknown): string {
  const json = JSON.stringify(data);

  // JSON.stringify returns undefined for undefined input (not a string)
  // Return null as valid JSON representation
  if (json === undefined) {
    return 'null';
  }

  // Replace dangerous characters that could break out of script context
  return json
    .replace(/</g, '\\u003c') // Escape < to prevent </script> injection
    .replace(/>/g, '\\u003e') // Escape > to prevent tag closures
    .replace(/\u2028/g, '\\u2028') // Line separator - valid JSON but breaks JS
    .replace(/\u2029/g, '\\u2029') // Paragraph separator - valid JSON but breaks JS
    .replace(/&/g, '\\u0026'); // Escape & to prevent HTML entity issues
}

/**
 * Parses JSON that was sanitized with sanitizeJSON()
 * This is just JSON.parse but provided for symmetry and clarity
 *
 * @param json - The sanitized JSON string
 * @returns The parsed data
 */
export function parseSanitizedJSON<T = unknown>(json: string): T {
  return JSON.parse(json);
}
