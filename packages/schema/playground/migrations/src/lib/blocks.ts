import { schema } from "../schema/schema";
import type { AnyBlock } from "../schema/schema";

/** Every block name the schema registers, for telling a known block from a stray one. */
export const BLOCK_NAMES: ReadonlySet<string> = new Set(
  Object.values(schema.blocks).map((block) => block.name),
);

export function isKnownBlock(value: unknown): value is AnyBlock {
  return (
    typeof value === "object" &&
    value !== null &&
    "component" in value &&
    typeof value.component === "string" &&
    BLOCK_NAMES.has(value.component)
  );
}
