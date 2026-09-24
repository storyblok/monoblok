/**
 * A rewrite inside a richtext document, where the thing being changed is a mark
 * on a text node rather than a field of a block. No structural op reaches in
 * there, and none should: the document's shape belongs to the editor, so the op
 * that touches it hands the whole value over and takes a new one back.
 *
 * The walk follows `content` and `marks` and nothing else, which is what keeps
 * it away from an embedded block. A `blok` node carries its blocks under
 * `attrs`, so they are never reached from here, and they do not need to be: an
 * embedded block is a block in its own right and the runner visits it like any
 * other. The `legacy` fixture holds a card embedded in a card's richtext with an
 * old link of its own, and it is migrated by that visit rather than by this walk.
 */
import { alterField, defineMigration } from "@storyblok/schema/migrations";

import type { Schema } from "../src/schema/schema";

const OLD_PREFIX = "/old-blog/";
const NEW_PREFIX = "/blog/";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rewriteHref(href: unknown): unknown {
  return typeof href === "string" && href.startsWith(OLD_PREFIX)
    ? `${NEW_PREFIX}${href.slice(OLD_PREFIX.length)}`
    : href;
}

function rewriteMark(mark: unknown): unknown {
  if (!isRecord(mark) || mark.type !== "link" || !isRecord(mark.attrs)) {
    return mark;
  }
  return { ...mark, attrs: { ...mark.attrs, href: rewriteHref(mark.attrs.href) } };
}

function rewriteNode(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(rewriteNode);
  }
  if (!isRecord(node)) {
    return node;
  }
  const next: Record<string, unknown> = { ...node };
  if (Array.isArray(node.marks)) {
    next.marks = node.marks.map(rewriteMark);
  }
  if (Array.isArray(node.content)) {
    next.content = node.content.map(rewriteNode);
  }
  return next;
}

export default defineMigration<Schema>({
  title: "Move richtext links off the old blog path",
  ops: [
    alterField({ block: "card", field: "body" }, (document) =>
      document === null || document === undefined ? document : rewriteNode(document),
    ),
  ],
});
