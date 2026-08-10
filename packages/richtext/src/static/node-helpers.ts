import type { RichTextMark, RichTextNode } from "../generated/overlay/types.gen";
import { deepEqual } from "../utils";

// ============================================================================
// Link Mark Helpers
// ============================================================================

export type LinkMark = Extract<RichTextMark, { type: "link" }>;

/**
 * Gets the link mark from a text node, or null if not present.
 * @param node - The node to check
 * @returns The link mark if found, null otherwise
 */
export function getTextNodeLinkMark(node: RichTextNode): LinkMark | null {
  if (node.type !== "text") {
    return null;
  }
  if (!node.marks) {
    return null;
  }
  for (const mark of node.marks) {
    if (mark.type === "link") {
      return mark as LinkMark;
    }
  }
  return null;
}

/**
 * Checks if two link marks have identical attributes.
 * Used for merging adjacent text nodes with the same link.
 * @param markA - First link mark
 * @param markB - Second link mark
 * @returns True if the marks have identical attributes
 */
export function areLinkMarksEqual(markA: LinkMark | null, markB: LinkMark | null): boolean {
  if (!markA || !markB) {
    return false;
  }

  return deepEqual(markA.attrs ?? {}, markB.attrs ?? {});
}

/**
 * Gets non-link marks from a text node.
 * Used when rendering text inside a merged link group.
 * @param node - The text node
 * @returns Array of marks excluding the link mark
 */
export function getInnerMarks(node: RichTextNode): RichTextMark[] {
  if (node.type !== "text") {
    return [];
  }
  return node.marks?.filter((m) => m.type !== "link") ?? [];
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
export function groupLinkNodes<T extends RichTextNode>(
  children: T[],
): Array<{
  nodes: T[];
  linkMark: LinkMark | null;
  _key: string;
}> {
  const groups: Array<{ nodes: T[]; linkMark: LinkMark | null; _key: string }> = [];
  let i = 0;
  const len = children.length;

  while (i < len) {
    const node = children[i];
    const linkMark = getTextNodeLinkMark(node);

    if (linkMark) {
      // Find end of link group (consecutive text nodes with same link)
      const groupNodes: T[] = [node];
      let end = i + 1;

      while (end < len && areLinkMarksEqual(linkMark, getTextNodeLinkMark(children[end]))) {
        groupNodes.push(children[end]);
        end++;
      }

      groups.push({ nodes: groupNodes, linkMark, _key: `group-link-${i}` });
      i = end;
    } else {
      groups.push({ nodes: [node], linkMark: null, _key: `group-node-${i}` });
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
export function isTableHeaderRow(row: RichTextNode): boolean {
  if (row.type !== "tableRow") {
    return false;
  }
  const cells = row.content;
  if (!cells?.length) {
    return false;
  }

  for (const cell of cells) {
    if (cell.type !== "tableHeader") {
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
export function splitTableRows<T extends RichTextNode>(
  rows: T[] | undefined,
): {
  headerRows: T[];
  bodyRows: T[];
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
