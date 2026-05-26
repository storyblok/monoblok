import { stringToStyle } from '../static';
import { kebabToCamel } from '../static/style';

/**
 * List of supported HTML attributes by tag name, used by the Reporter mark.
 */
export const supportedAttributesByTagName: Record<string, string[]> = {
  a: ['href', 'target', 'data-uuid', 'data-anchor', 'data-linktype'],
  img: ['alt', 'src', 'title'],
  span: ['class'],
} as const;

/**
 * Gets allowed style classes for an element, warning on invalid ones.
 */
export function getAllowedStylesForElement(element: HTMLElement, { allowedStyles }: { allowedStyles: string[] }): string[] {
  const classString = element.getAttribute('class') || '';
  const classes = classString.split(' ').filter(Boolean);
  if (!classes.length) {
    return [];
  }

  const invalidStyles = classes.filter(x => !allowedStyles.includes(x));
  for (const invalidStyle of invalidStyles) {
    console.warn(`[StoryblokRichText] - \`class\` "${invalidStyle}" on \`<${element.tagName.toLowerCase()}>\` can not be transformed to rich text.`);
  }

  return allowedStyles.filter(x => classes.includes(x));
}
/**
 * Creates a DOM attribute parser for use in rich text extensions.
 *
 * The returned function extracts a value from an element by:
 * 1. Checking one or more HTML attributes (in order).
 * 2. Also can map to CSS inline style property.
 *
 * The first non-empty value found is returned.
 *
 * Example:
 * <div data-source="example" data-copyright="2024"></div>
 * attributeParsers: {
 *   source: mapToAttribute('data-source'),
 *   copyright: mapToAttribute(['data-copyright', 'data-rights']),
 * }
 * Style Example:
 * <div name="example" style="color: red; font-size: 16px;"></div>
 * attributeParsers: {
 *   name: mapToAttribute('name'),
 *   color: mapToAttribute(undefined, 'color'),
 *   fontSize: mapToAttribute(undefined, 'font-size'),
 * }
 *
 * @param attributes - A single attribute name or list of attribute names to read from.
 * @param styleProperty - Optional CSS property name to read from the element's inline style.
 * @returns A function that receives an HTMLElement and returns the resolved value or null.
 */
export function mapToAttribute(attributes?: string[] | string, styleProperty?: string) {
  return (el: HTMLElement): string | null => {
    // 1. Check attributes first
    if (attributes) {
      const attrs = Array.isArray(attributes) ? attributes : [attributes];
      for (const name of attrs) {
        const value = el.getAttribute(name);
        if (value) {
          return value;
        }
      }
    }

    // 2. Check style
    if (styleProperty) {
      const style = el.getAttribute('style');
      if (style) {
        const styleObj = stringToStyle(style);
        const value = styleObj[kebabToCamel(styleProperty)];
        if (value) {
          return value;
        }
      }
    }

    return null;
  };
}
