import type { AttrValue } from "./types";

/**
 * Converts a style object to a CSS string.
 * @param style - The style object to convert.
 * @returns A CSS string representation of the style object.
 * @example
 * const styleObj = { color: 'red', fontSize: '16px' };
 * const cssString = styleToString(styleObj);
 * console.log(cssString); // Output: "color: red; font-size: 16px"
 */
export function styleToString(style: Record<string, AttrValue>) {
  return Object.entries(style)
    .filter(([, v]) => isValidStyleValue(v))
    .map(([k, v]) => `${camelToKebab(k)}: ${v}`)
    .join("; ");
}

/**
 * Converts a CSS string to a style object.
 * @param style - The CSS string to convert.
 * @returns A style object representation of the CSS string.
 * @example
 * const cssString = "color: red; font-size: 16px";
 * const styleObj = stringToStyle(cssString);
 * console.log(styleObj); // Output: { color: 'red', fontSize: '16px' }
 */
export function stringToStyle(style: string): Record<string, string> {
  return style
    .split(";")
    .map((rule) => rule.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, rule) => {
      const colonIdx = rule.indexOf(":");

      // ignore invalid declarations like "color" or ": red"
      if (colonIdx === -1) {
        return acc;
      }

      const key = rule.slice(0, colonIdx).trim();
      const value = rule.slice(colonIdx + 1).trim();

      if (!key || !value) {
        return acc;
      }

      acc[kebabToCamel(key)] = value;
      return acc;
    }, {});
}

function kebabToCamel(str: string) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
function camelToKebab(str: string) {
  return str.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}
export function isValidStyleValue(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}
