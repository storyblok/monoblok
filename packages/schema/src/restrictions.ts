/**
 * Facts about the field restriction keys that both the `define*` helpers and the
 * validators need. They live here rather than in either so neither layer takes a
 * runtime dependency on the other, and so there is one list to change.
 */

/**
 * Wire restriction keys that `allow` / `deny` replace and derive the flags for.
 * Setting a DSL key and one of these on the same field is always a mistake:
 * `schema push` derives them from the DSL keys and overwrites whatever was set by
 * hand, so one of the two silently loses.
 *
 * `restrict_type` is deliberately absent. Push overwrites it the same way, but it
 * is also the only way to reach the tag dimension, which `allow` / `deny` cannot
 * express, so rejecting it outright would remove the one legitimate reason to set
 * a restriction key by hand.
 */
export const DERIVED_RESTRICTION_KEYS = [
  "component_whitelist",
  "component_group_whitelist",
  "component_denylist",
  "component_group_denylist",
  "restrict_components",
] as const;

export type DerivedRestrictionKey = (typeof DERIVED_RESTRICTION_KEYS)[number];

/**
 * The field types whose nested-block picker reads the restriction lists, and so
 * the only ones a `deny` can mean anything on.
 *
 * `allow` is deliberately not limited to these: `component_whitelist` is also
 * real on `multilink`, where it selects story content types rather than blocks.
 * There is no denylist counterpart to that, so a `deny` anywhere else writes a
 * key nothing reads.
 */
export const DENIABLE_FIELD_TYPES: readonly string[] = ["bloks", "richtext"];
