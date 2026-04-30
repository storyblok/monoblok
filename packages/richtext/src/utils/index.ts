import type { BlockAttributes, MarkNode, StoryblokRichTextNode, TextNode } from "../types";

/**
 * Deep equality comparison for plain objects, arrays, and primitives.
 */
export function deepEqual(a: any, b: any): boolean {
  if (a === b) {
    return true;
  }
  if (a === null || a === undefined || b === null || b === undefined) {
    return a === b;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (typeof a !== "object") {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }
  if (Array.isArray(a)) {
    if (a.length !== (b as any[]).length) {
      return false;
    }
    return a.every((v: any, i: number) => deepEqual(v, (b as any[])[i]));
  }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  return aKeys.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}

/** Checks if two marks are equal by comparing their type and attrs. */
export function markEquals<T>(a: MarkNode<T>, b: MarkNode<T>): boolean {
  return a.type === b.type && deepEqual(a.attrs, b.attrs);
}

/** Type guard: checks if a node is a text node with at least one mark. */
export function isMarkedTextNode<T>(node: StoryblokRichTextNode<T>): node is TextNode<T> {
  return node.type === "text" && !!(node as TextNode<T>).marks?.length;
}

/** Returns marks unique to a node (not in the shared set), or undefined if all marks are shared. */
export function getUniqueMarks<T>(
  marks: MarkNode<T>[],
  shared: MarkNode<T>[],
): MarkNode<T>[] | undefined {
  const unique = marks.filter((m) => !shared.some((s) => markEquals(s, m)));
  return unique.length ? unique : undefined;
}

export interface MarkedTextGroup<T> {
  group: TextNode<T>[];
  shared: MarkNode<T>[];
  endIndex: number;
}

/**
 * Starting at `fromIndex`, collects adjacent marked text nodes that share at least one common mark.
 * Returns null if the node at `fromIndex` is not a marked text node.
 */
export function collectMarkedTextGroup<T>(
  children: StoryblokRichTextNode<T>[],
  fromIndex: number,
): MarkedTextGroup<T> | null {
  const child = children[fromIndex];
  if (!isMarkedTextNode(child)) {
    return null;
  }

  const group: TextNode<T>[] = [child];
  let shared: MarkNode<T>[] = child.marks!;
  let j = fromIndex + 1;
  while (j < children.length) {
    const next = children[j];
    if (!isMarkedTextNode(next)) {
      break;
    }
    const nextShared = shared.filter((m) => next.marks!.some((n) => markEquals(m, n)));
    if (nextShared.length === 0) {
      break;
    }
    shared = nextShared;
    group.push(next);
    j++;
  }

  return { group, shared, endIndex: j };
}

export const SELF_CLOSING_TAGS = [
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
];

export const BLOCK_LEVEL_TAGS = [
  "address",
  "article",
  "aside",
  "blockquote",
  "canvas",
  "dd",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hgroup",
  "hr",
  "li",
  "main",
  "nav",
  "noscript",
  "ol",
  "output",
  "p",
  "pre",
  "section",
  "table",
  "tfoot",
  "ul",
  "video",
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
export const attrsToString = (attrs: BlockAttributes = {}) => {
  const { custom, ...attrsWithoutCustom } = attrs;
  const normalizedAttrs = { ...attrsWithoutCustom, ...custom };
  return Object.keys(normalizedAttrs)
    .filter((key) => normalizedAttrs[key] != null)
    .map(
      (key) =>
        `${key}="${String(normalizedAttrs[key]).replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`,
    )
    .join(" ");
};

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
export const attrsToStyle = (attrs: Record<string, string> = {}) =>
  Object.keys(attrs)
    .map((key) => `${key}: ${attrs[key]}`)
    .join("; ");

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
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v != null));
};
