import { renderRichText } from "@storyblok/richtext";

import { isKnownBlock } from "./blocks";
import type { AnyBlock, Block } from "../schema/schema";

type RichtextValue = NonNullable<Block<"card">["body"]>;
type RichtextNode = RichtextValue["content"][number];

/**
 * A richtext document rendered as an alternating run of HTML and embedded blocks.
 *
 * Embedded blocks have to leave the HTML string so they can be dispatched to the
 * same components as the rest of the page; a migration that rewrites a block only
 * inside richtext is otherwise invisible.
 *
 * `unrecognized` carries embedded values whose `component` is not in the schema,
 * for instance a block a rename migration missed. They are rendered as-is rather
 * than skipped, so nothing disappears from the page unannounced.
 */
export type RichtextSegment =
  | { kind: "html"; html: string }
  | { kind: "blocks"; blocks: AnyBlock[]; unrecognized: unknown[] };

function embeddedValues(node: RichtextNode): unknown[] | null {
  if (node.type !== "blok") {
    return null;
  }
  const body = node.attrs?.body;
  return Array.isArray(body) ? body : [];
}

export function splitRichtext(document: RichtextValue | null | undefined): RichtextSegment[] {
  const nodes = document?.content;
  if (!nodes?.length) {
    return [];
  }

  const segments: RichtextSegment[] = [];
  let run: RichtextNode[] = [];

  const flush = (): void => {
    if (run.length === 0) {
      return;
    }
    segments.push({ kind: "html", html: renderRichText({ type: "doc", content: run }) });
    run = [];
  };

  for (const node of nodes) {
    const values = embeddedValues(node);
    if (values) {
      flush();
      segments.push({
        kind: "blocks",
        blocks: values.filter(isKnownBlock),
        unrecognized: values.filter((value) => !isKnownBlock(value)),
      });
      continue;
    }
    run.push(node);
  }
  flush();

  return segments;
}
