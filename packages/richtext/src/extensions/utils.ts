import type { BlockAttributes } from '../types';
import { LinkTypes } from '../types';
import { cleanObject } from '../utils';

/**
 * Processes block-level attributes, converting textAlign to inline style
 * and preserving class/id/existing style.
 */
export function processBlockAttrs(attrs: BlockAttributes = {}): BlockAttributes {
  const { textAlign, class: className, id: idName, style: existingStyle, ...rest } = attrs;
  const styles: string[] = [];

  if (existingStyle) {
    styles.push(existingStyle.endsWith(';') ? existingStyle : `${existingStyle};`);
  }

  if (textAlign) {
    styles.push(`text-align: ${textAlign};`);
  }

  return cleanObject({
    ...rest,
    class: className,
    id: idName,
    ...(styles.length > 0 ? { style: styles.join(' ') } : {}),
  });
}

/**
 * Resolves a Storyblok link's attributes into a final href and remaining attrs.
 */
export function resolveStoryblokLink(attrs: Record<string, any> = {}): { href: string; rest: Record<string, any> } {
  const { linktype, href, anchor, ...rest } = attrs;

  let finalHref = '';
  switch (linktype) {
    case LinkTypes.ASSET:
    case LinkTypes.URL:
      finalHref = href;
      break;
    case LinkTypes.EMAIL:
      finalHref = `mailto:${href}`;
      break;
    case LinkTypes.STORY:
      finalHref = href;
      if (anchor) {
        finalHref = `${finalHref}#${anchor}`;
      }
      break;
    default:
      finalHref = href;
      break;
  }

  return { href: finalHref, rest };
}

/**
 * Computes table cell attributes, converting colwidth/backgroundColor/textAlign to CSS styles.
 */
export function computeTableCellAttrs(attrs: Record<string, any> = {}): BlockAttributes {
  const { colspan, rowspan, colwidth, backgroundColor, textAlign, ...rest } = attrs;
  const styles: string[] = [];

  if (colwidth) {
    styles.push(`width: ${colwidth}px;`);
  }

  if (backgroundColor) {
    styles.push(`background-color: ${backgroundColor};`);
  }

  if (textAlign) {
    styles.push(`text-align: ${textAlign};`);
  }

  return cleanObject({
    ...rest,
    ...(colspan > 1 ? { colspan } : {}),
    ...(rowspan > 1 ? { rowspan } : {}),
    ...(styles.length > 0 ? { style: styles.join(' ') } : {}),
  });
}

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
