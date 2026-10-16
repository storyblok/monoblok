export const INDENT = "  ";

/**
 * Wraps a string so {@link formatValue} emits it verbatim (unquoted) instead of
 * as a string literal. Used by code generation to place a bare identifier (e.g.
 * an imported `defineFolder` ref) inside an otherwise data-shaped value.
 */
export class RawCode {
  constructor(public readonly code: string) {}
}

/**
 * Serializes a string as a single-quoted TS literal with correct escaping.
 * Uses JSON.stringify for backslash/control-char/newline handling, then converts
 * the double-quoted result to single-quoted output. Without this, backslashes in
 * values like regexes are silently dropped and raw newlines break the parse.
 */
export function quoteString(value: string): string {
  const escaped = JSON.stringify(value).slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'");
  return `'${escaped}'`;
}

// A line break ends a line comment and a star-slash ends a block comment;
// either would turn the rest of the text into code.
const COMMENT_TERMINATORS = /[\r\n\u2028\u2029]+|\*\//g;

/** Makes arbitrary text safe to place inside a line or block comment. */
export function commentText(text: string): string {
  return text.replace(COMMENT_TERMINATORS, (match) => (match === "*/" ? "* /" : " "));
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

export function isIdentifier(name: string): boolean {
  return IDENTIFIER.test(name);
}

/** An object key as written in a literal, quoted unless it is a valid identifier. */
export function propertyKey(key: string): string {
  return isIdentifier(key) ? key : quoteString(key);
}

/**
 * Formats a JavaScript value as a multi-line code string.
 * All object properties are placed on separate lines.
 * Object keys are sorted alphabetically for stable output.
 */
export function formatValue(value: unknown, depth: number): string {
  const indent = INDENT.repeat(depth);
  const innerIndent = INDENT.repeat(depth + 1);

  if (value === null || value === undefined) {
    return String(value);
  }
  if (value instanceof RawCode) {
    return value.code;
  }
  if (typeof value === "string") {
    return quoteString(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    const items = value.map((item) => `${innerIndent}${formatValue(item, depth + 1)},`);
    return `[\n${items.join("\n")}\n${indent}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined && v !== null)
      .sort(([a], [b]) => a.localeCompare(b));
    if (entries.length === 0) {
      return "{}";
    }
    const props = entries.map(
      ([key, val]) => `${innerIndent}${propertyKey(key)}: ${formatValue(val, depth + 1)},`,
    );
    return `{\n${props.join("\n")}\n${indent}}`;
  }
  return String(value);
}
