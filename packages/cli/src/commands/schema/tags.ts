import { TAG_LIST_KEYS } from "@storyblok/schema";

import type { Component } from "../../types";
import { isRecord } from "./utils";

/**
 * Block tags are managed in code by name. A block declares its own tags under a
 * transient `tags` key and a field restricts by tag through `{ tag: name }`
 * entries, which the wire mapping writes into `component_tag_whitelist` /
 * `component_tag_denylist` as names. `schema push` resolves every name to the
 * target space's tag id — creating the tag when the space does not have it yet —
 * so the same schema pushes to any space.
 *
 * Tag ids remain legal in both places as a same-space escape hatch, and are what
 * the Management API hands back, so both spaces coexist in these keys: a string
 * entry is a name, a number is an id. Identity is the exact tag name; Storyblok
 * makes it unique per space and object type, and unlike a folder path it never
 * doubles as a directory name, so it is used verbatim rather than slugified.
 */

export { TAG_LIST_KEYS };

/** A tag entry in the transient name space (a name) or the server's id space. */
export type TagEntry = string | number;

/**
 * Returns a copy of a wire `schema` record with every field's tag list entries
 * (see {@link TAG_LIST_KEYS}) passed through `mapEntry`. Fields carrying neither
 * key are copied through untouched; the source objects are never mutated. An
 * entry `mapEntry` cannot translate should be returned as-is by the caller, so it
 * still produces a visible diff or reaches the API for the server to reject.
 */
export function mapSchemaTagLists(
  schema: unknown,
  mapEntry: (entry: TagEntry) => TagEntry,
): unknown {
  if (!isRecord(schema)) {
    return schema;
  }
  const result: Record<string, unknown> = {};
  for (const [fieldName, field] of Object.entries(schema)) {
    if (!isRecord(field) || !TAG_LIST_KEYS.some((key) => Array.isArray(field[key]))) {
      result[fieldName] = field;
      continue;
    }
    const mapped: Record<string, unknown> = { ...field };
    for (const key of TAG_LIST_KEYS) {
      const list = field[key];
      if (Array.isArray(list)) {
        mapped[key] = list.map((entry) =>
          typeof entry === "string" || typeof entry === "number" ? mapEntry(entry) : entry,
        );
      }
    }
    result[fieldName] = mapped;
  }
  return result;
}

/**
 * The tag names a local block references: its own `tags`, plus the name entries
 * of its fields' tag lists. Ids are skipped — they already name a tag in the
 * space they came from, and there is nothing to look up.
 */
export function collectTagNames(component: Component): string[] {
  const names = new Set<string>();
  const { tags, schema } = component as unknown as Record<string, unknown>;
  if (Array.isArray(tags)) {
    for (const tag of tags) {
      if (typeof tag === "string") {
        names.add(tag);
      }
    }
  }
  mapSchemaTagLists(schema, (entry) => {
    if (typeof entry === "string") {
      names.add(entry);
    }
    return entry;
  });
  return [...names];
}
