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
 * `restrict_type` is deliberately absent. Push overwrites it the same way, but
 * setting it by hand is how a field reaches a restriction dimension whose lists
 * were written by hand too, so rejecting it outright would take away the escape
 * hatch the raw keys exist for.
 */
export const DERIVED_RESTRICTION_KEYS = [
  "component_whitelist",
  "component_group_whitelist",
  "component_denylist",
  "component_group_denylist",
  "component_tag_whitelist",
  "component_tag_denylist",
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

/**
 * The values the editor's restriction-dimension selector writes: `'groups'` for
 * the component group lists, `'tags'` for the tag lists, and `''` or
 * `'components'` for the block-name lists.
 *
 * Not a type. The Management API stores `restrict_type` without validating it, so
 * a space can hold anything there and `schema init` has to be able to emit
 * whatever it finds. Narrowing the declared type would buy typo protection by
 * making a real stored value untypeable, which is the failure this whole area
 * exists to remove. `validateSchema` warns on an unrecognized value instead: it
 * catches the typo without breaking the read path.
 */
export const EDITOR_RESTRICT_TYPES: readonly string[] = ["", "components", "groups", "tags"];

/**
 * The wire restriction keys holding block tag references. Both halves, for the
 * same reason as the group lists: a denylist is as space-bound as its whitelist,
 * so anything translating between the transient tag-name space and the server's
 * id space has to walk both.
 */
export const TAG_LIST_KEYS = ["component_tag_whitelist", "component_tag_denylist"] as const;
