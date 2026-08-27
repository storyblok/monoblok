import type { ConditionalSettingRoot } from "../generated/overlay/_internal.gen";

/**
 * One comparison against a sibling field in the same block.
 *
 * `is: 'empty'` and `is: 'not_empty'` ignore `value`. `gt`/`lt` compare numbers,
 * or dates when both sides parse as `YYYY-MM-DD HH:mm`. An unchecked boolean
 * counts as empty, but a field the story has never touched is absent rather than
 * empty, and the editor treats an absent field as no match: a fresh story shows
 * the field until the operator has toggled the reference field at least once.
 */
export interface FieldCondition {
  /** Key of the sibling field to read, within the same block. */
  field: string;
  /** The comparison to run. */
  is: "equals" | "not_equals" | "empty" | "not_empty" | "gt" | "lt";
  /** The value compared against. Omit for `empty`/`not_empty`. */
  value?: unknown;
}

/** How a multi-condition rule combines. Defaults to `all`. */
export interface ConditionOptions {
  match?: "all" | "any";
}

/** The wire form of a single condition inside `rule_conditions`. */
type RuleCondition = NonNullable<ConditionalSettingRoot["rule_conditions"]>[number];

function toRuleConditions(conditions: FieldCondition | FieldCondition[]): RuleCondition[] {
  const list = Array.isArray(conditions) ? conditions : [conditions];

  return list.map(({ field, is, value }) => ({
    validated_object: { type: "field", field_key: field, field_attr: "value" },
    validation: is,
    ...(value === undefined ? {} : { value }),
  }));
}

/**
 * Hides the field while the conditions match.
 *
 * Emits the `hide` spelling, which is the one the editor writes and reads. The
 * server's conditional-required check recognizes only `hidden`, so a hidden
 * field is still required on save; use {@link requiredWhen} to drive that side.
 *
 * @example
 * defineField('cta_label', {
 *   type: 'text',
 *   conditional_settings: [hideWhen({ field: 'show_cta', is: 'empty' })],
 * });
 */
export function hideWhen(
  conditions: FieldCondition | FieldCondition[],
  options: ConditionOptions = {},
): ConditionalSettingRoot {
  return {
    modifications: [{ display: "hide" }],
    rule_match: options.match ?? "all",
    rule_conditions: toRuleConditions(conditions),
  };
}

/**
 * Makes the field required while the conditions match.
 *
 * @example
 * defineField('shipping_address', {
 *   type: 'textarea',
 *   conditional_settings: [
 *     requiredWhen([
 *       { field: 'needs_delivery', is: 'not_empty' },
 *       { field: 'region', is: 'equals', value: 'eu' },
 *     ]),
 *   ],
 * });
 */
export function requiredWhen(
  conditions: FieldCondition | FieldCondition[],
  options: ConditionOptions = {},
): ConditionalSettingRoot {
  return {
    modifications: [{ required: true }],
    rule_match: options.match ?? "all",
    rule_conditions: toRuleConditions(conditions),
  };
}
