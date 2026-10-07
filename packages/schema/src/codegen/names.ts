// Mirrors the CLI's `slugify`: reduces a name to `[a-z0-9_-]`.
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

/**
 * Converts an arbitrary name into a valid camelCase JS identifier.
 * `slugify` reduces the input to `[a-z0-9_-]` (symbols stripped, spaces → `-`);
 * we then camelCase across `_`/`-` runs and guard against an empty or
 * leading-digit result so the output is always usable as an identifier.
 */
export function toCamelCaseIdentifier(str: string): string {
  const camel = slugify(str)
    .replace(/^[_-]+/, "")
    .replace(/[_-]+(.)/g, (_, char: string) => char.toUpperCase());
  if (!camel) {
    return "_";
  }
  return /^\d/.test(camel) ? `_${camel}` : camel;
}

/** Returns the variable name for a component. e.g. `'teaser_list'` -> `'teaserListBlock'` */
export function componentVarName(name: string): string {
  return `${toCamelCaseIdentifier(name)}Block`;
}

/**
 * Resolves an ordered list of raw names to unique variable names. Names that
 * sanitize to the same identifier get a numeric suffix (`…2`, `…3`), so the
 * generated `export const`s and schema-object keys never collide. Index-aligned
 * to `rawNames`.
 */
export function resolveVarNames(
  rawNames: string[],
  baseVarName: (name: string) => string,
): string[] {
  const used = new Set<string>();
  return rawNames.map((raw) => {
    const base = baseVarName(raw);
    let candidate = base;
    let n = 2;
    while (used.has(candidate)) {
      candidate = `${base}${n++}`;
    }
    used.add(candidate);
    return candidate;
  });
}
