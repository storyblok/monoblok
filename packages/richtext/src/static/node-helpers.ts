import type { PMMark } from './types.generated';
import type { SbRichTextDoc } from './types';

// ============================================================================
// Link Mark Helpers
// ============================================================================

/**
 * Gets the link mark from a text node, or null if not present.
 * @param node - The node to check
 * @returns The link mark if found, null otherwise
 */
export function getTextNodeLinkMark(node: SbRichTextDoc): PMMark | null {
  if (node.type !== 'text' || !node.marks) {
    return null;
  }

  for (const mark of node.marks) {
    if (mark.type === 'link') {
      return mark;
    }
  }
  return null;
}

/**
 * Checks if two link marks have identical attributes.
 * Used for merging adjacent text nodes with the same link.
 * @param a - First link mark
 * @param b - Second link mark
 * @returns True if the marks have identical attributes
 */
export function areLinkMarksEqual(a: PMMark | null, b: PMMark | null): boolean {
  if (!a || !b) {
    return false;
  }

  const aa = (a.attrs ?? {}) as Record<string, unknown>;
  const ba = (b.attrs ?? {}) as Record<string, unknown>;

  return (
    aa.href === ba.href
    && aa.target === ba.target
    && aa.linktype === ba.linktype
    && aa.anchor === ba.anchor
    && aa.uuid === ba.uuid
  );
}

/**
 * Gets non-link marks from a text node.
 * Used when rendering text inside a merged link group.
 * @param node - The text node
 * @returns Array of marks excluding the link mark
 */
export function getInnerMarks(node: SbRichTextDoc): PMMark[] {
  if (node.type !== 'text' || !node.marks) {
    return [];
  }
  return node.marks.filter(m => m.type !== 'link');
}

/**
 * Identifies groups of adjacent text nodes that share the same link mark.
 * Returns an array of groups where each group is either:
 * - A single non-text node or text node without link
 * - Multiple consecutive text nodes with identical link marks
 *
 * @param children - Array of child nodes to group
 * @returns Array of node groups for rendering
 */
export function groupLinkNodes(children: SbRichTextDoc[]): Array<{
  nodes: SbRichTextDoc[];
  linkMark: PMMark | null;
}> {
  const groups: Array<{ nodes: SbRichTextDoc[]; linkMark: PMMark | null }> = [];
  let i = 0;
  const len = children.length;

  while (i < len) {
    const node = children[i];
    const linkMark = getTextNodeLinkMark(node);

    if (linkMark) {
      // Find end of link group (consecutive text nodes with same link)
      const groupNodes: SbRichTextDoc[] = [node];
      let end = i + 1;

      while (end < len && areLinkMarksEqual(linkMark, getTextNodeLinkMark(children[end]))) {
        groupNodes.push(children[end]);
        end++;
      }

      groups.push({ nodes: groupNodes, linkMark });
      i = end;
    }
    else {
      groups.push({ nodes: [node], linkMark: null });
      i++;
    }
  }

  return groups;
}

// ============================================================================
// Table Helpers
// ============================================================================

/**
 * Checks if a table row contains only tableHeader cells.
 * Used to determine which rows belong in thead vs tbody.
 * @param row - The table row node to check
 * @returns True if all cells are tableHeader type
 */
export function isTableHeaderRow(row: SbRichTextDoc): boolean {
  const cells = row.content;
  if (!cells?.length) {
    return false;
  }

  for (const cell of cells) {
    if (cell.type !== 'tableHeader') {
      return false;
    }
  }
  return true;
}

/**
 * Splits table rows into header rows and body rows.
 * Header rows are contiguous tableHeader rows at the start.
 * @param rows - Array of table row nodes
 * @returns Object with headerRows and bodyRows arrays
 */
export function splitTableRows(rows: SbRichTextDoc[] | undefined): {
  headerRows: SbRichTextDoc[];
  bodyRows: SbRichTextDoc[];
} {
  if (!rows?.length) {
    return { headerRows: [], bodyRows: [] };
  }

  // Find where header rows end (contiguous tableHeader rows at start)
  let headerEnd = 0;
  while (headerEnd < rows.length && isTableHeaderRow(rows[headerEnd])) {
    headerEnd++;
  }

  return {
    headerRows: rows.slice(0, headerEnd),
    bodyRows: rows.slice(headerEnd),
  };
}
