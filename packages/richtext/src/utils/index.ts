export const SELF_CLOSING_TAGS = [
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
];

/**
 * Converts an object of attributes to a string.
 *
 * @param {Record<string, string>} [attrs]
 *
 * @returns {string} The string representation of the attributes.
 *
 * @example
 *
 * ```typescript
 * const attrs = {
 *  class: 'text-red',
 *  style: 'color: red',
 * }
 *
 * const attrsString = attrsToString(attrs)
 *
 * console.log(attrsString) // 'class="text-red" style="color: red"'
 *
 * ```
 *
 */
export const attrsToString = (attrs: Record<string, string> = {}) => Object.keys(attrs)
  .map(key => `${key}="${attrs[key]}"`)
  .join(' ');

/**
 * Converts an object of attributes to a CSS style string.
 *
 * @param {Record<string, string>} [attrs]
 *
 * @returns {string} The string representation of the CSS styles.
 *
 * @example
 *
 * ```typescript
 * const attrs = {
 *  color: 'red',
 *  fontSize: '16px',
 * }
 *
 * const styleString = attrsToStyle(attrs)
 *
 * console.log(styleString) // 'color: red; font-size: 16px'
 * ```
 */
export const attrsToStyle = (attrs: Record<string, string> = {}) => Object.keys(attrs)
  .map(key => `${key}: ${attrs[key]}`)
  .join('; ');

/**
 * Escapes HTML entities in a string.
 *
 * @param {string} unsafeText
 * @return {*}  {string}
 *
 * @example
 *
 * ```typescript
 * const unsafeText = '<script>alert("Hello")</script>'
 *
 * const safeText = escapeHtml(unsafeText)
 *
 * console.log(safeText) // '&lt;script&gt;alert("Hello")&lt;/script&gt;'
 * ```
 */
export function escapeHtml(unsafeText: string): string {
  return unsafeText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Removes undefined values from an object.
 *
 * @param {Record<string, any>} obj
 * @return {*}  {Record<string, any>}
 *
 * @example
 *
 * ```typescript
 * const obj = {
 * name: 'John',
 * age: undefined,
 * }
 *
 * const cleanedObj = cleanObject(obj)
 *
 * console.log(cleanedObj) // { name: 'John' }
 * ```
 *
 */
export const cleanObject = (obj: Record<string, any>) => {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
};
