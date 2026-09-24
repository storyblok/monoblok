/**
 * A rewrite inside a richtext document, where the thing being changed is a mark
 * on a text node rather than a field of a block. No structural op reaches in
 * there, and none should: the document's shape belongs to the editor, so the op
 * that touches it hands the whole value over and takes a new one back.
 *
 * The walk stops at a `blok` node on purpose. What it embeds is a block in its
 * own right, which the runner visits separately, so descending into it would
 * apply the same op to the same block twice.
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
  if (!isRecord(node) || node.type === "blok") {
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
