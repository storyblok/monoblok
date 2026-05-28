/**
 * Converts component `internal_tag_ids` from the response shape to the request
 * shape. The MAPI component serializer returns tag IDs as `string[]`, while
 * `ComponentCreate`/`ComponentUpdate` expect `number[]` — a known upstream
 * inconsistency (every other resource uses integer tag IDs). This is the single
 * boundary where response tag IDs are echoed back into a create/update payload.
 *
 * Kept dependency-free on purpose: `actions.ts` (which imports this) is part of
 * an import cycle via `graph-operations/dependency-graph`, so this must not pull
 * in any module that re-enters `actions.ts`.
 */
export function toRequestTagIds(
  tagIds: ReadonlyArray<string | number> | undefined,
): number[] | undefined {
  if (!tagIds) { return undefined; }
  return tagIds.map(id => Number(id));
}
