import type { SchemaFieldLike } from "./shapes";
import { isRecord } from "./shapes";

/**
 * How a field's conditional settings change whether it is required, given the
 * content of the block it sits in. `unchanged` leaves the field's own
 * `required` flag in charge.
 */
export type ConditionalRequirement = "required" | "not_required" | "unchanged";

/**
 * Resolves a field's conditional settings against its sibling values the way
 * the editor does: only the first setting and its first modification count. A
 * matching `display: 'hide'` takes precedence over `required`, and a hidden
 * field is never required. `required: false` lifts a static `required`.
 */
export function resolveConditionalRequirement(
  field: SchemaFieldLike,
  content: Record<string, unknown>,
): ConditionalRequirement {
  const setting = field.conditional_settings?.[0];
  if (!isRecord(setting) || !matchesRule(setting.rule_match, setting.rule_conditions, content)) {
    return "unchanged";
  }
  const modification = Array.isArray(setting.modifications) ? setting.modifications[0] : undefined;
  if (!isRecord(modification)) {
    return "unchanged";
  }
  if (modification.display === "hide") {
    return "not_required";
  }
  if (modification.required) {
    return "required";
  }
  return modification.required === false ? "not_required" : "unchanged";
}

/**
 * `all` with no conditions matches, `any` with none does not, and any other
 * `rule_match` (including the unset one of a half-configured rule) never does.
 */
function matchesRule(
  ruleMatch: unknown,
  conditions: unknown,
  content: Record<string, unknown>,
): boolean {
  const list: unknown[] = Array.isArray(conditions) ? conditions : [];
  if (ruleMatch === "all") {
    return list.every((condition) => matchesCondition(condition, content));
  }
  if (ruleMatch === "any") {
    return list.some((condition) => matchesCondition(condition, content));
  }
  return false;
}

/**
 * A field absent from the content matches no condition, `empty` included: the
 * editor treats a field the story has never touched as unknown, not as empty.
 */
function matchesCondition(condition: unknown, content: Record<string, unknown>): boolean {
  if (!isRecord(condition)) {
    return false;
  }
  const fieldKey = isRecord(condition.validated_object)
    ? condition.validated_object.field_key
    : undefined;
  if (typeof fieldKey !== "string" || content[fieldKey] === undefined) {
    return false;
  }
  const fieldValue = toComparable(content[fieldKey]);
  const expected = toComparable(condition.value);

  switch (condition.validation) {
    case "equals":
      return isEqualToExpected(fieldValue, expected);
    case "not_equals":
      return !isEqualToExpected(fieldValue, expected);
    case "empty":
      return isEmptyConditionValue(fieldValue);
    case "not_empty":
      return !isEmptyConditionValue(fieldValue);
    case "gt":
      return (compareOrdered(fieldValue, expected) ?? 0) > 0;
    case "lt":
      return (compareOrdered(fieldValue, expected) ?? 0) < 0;
    default:
      return false;
  }
}

/**
 * Reduces a value to what conditions compare: an asset to its `filename`, a
 * link to its `id` (or `url` when the id is blank), and each asset in a list to
 * its `filename`.
 */
function toComparable(value: unknown): unknown {
  if (isRecord(value) && value.fieldtype === "asset") {
    return value.filename;
  }
  if (isRecord(value) && value.fieldtype === "multilink") {
    return value.id || value.url;
  }
  if (Array.isArray(value)) {
    return value.map((item) => (isRecord(item) && "fieldtype" in item ? item.filename : item));
  }
  return value;
}

/** An unset expected value never equals anything, so `not_equals` against it always matches. */
function isEqualToExpected(value: unknown, expected: unknown): boolean {
  return expected !== null && expected !== undefined && isDeepEqual(value, expected);
}

function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b || (Number.isNaN(a) && Number.isNaN(b))) {
    return true;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => isDeepEqual(item, b[index]))
    );
  }
  if (isRecord(a) && isRecord(b)) {
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every((key) => Object.hasOwn(b, key) && isDeepEqual(a[key], b[key]))
    );
  }
  return false;
}

/**
 * Whether a value is empty for a condition. `0` and `false` count as empty, a
 * whitespace-only string does too, and a richtext document is empty when none
 * of its nodes carries text or an embed.
 */
function isEmptyConditionValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim() === "";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return !value;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (!isRecord(value)) {
    return false;
  }
  return isRichtextNode(value) ? isRichtextNodeEmpty(value) : Object.keys(value).length === 0;
}

function isRichtextNode(value: Record<string, unknown>): boolean {
  return (
    typeof value.type === "string" &&
    (!("content" in value) || Array.isArray(value.content)) &&
    (!("text" in value) || typeof value.text === "string")
  );
}

function isRichtextNodeEmpty(node: unknown): boolean {
  if (typeof node === "string") {
    return node.trim() === "";
  }
  if (!isRecord(node)) {
    return true;
  }
  const attrs = isRecord(node.attrs) ? node.attrs : {};
  const hasEmbed =
    (node.type === "image" && Boolean(attrs.src)) ||
    (node.type === "blok" && Array.isArray(attrs.body) && attrs.body.length > 0) ||
    (node.type === "emoji" && Boolean(attrs.emoji)) ||
    node.type === "horizontal_rule";
  if (hasEmbed || (typeof node.text === "string" && node.text.trim() !== "")) {
    return false;
  }
  return !Array.isArray(node.content) || node.content.every(isRichtextNodeEmpty);
}

/** The datetime field's wire form. Both sides must match it for a date comparison. */
const DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;

function isDatetime(value: unknown): value is string {
  const match = typeof value === "string" ? DATETIME_PATTERN.exec(value) : null;
  if (!match) {
    return false;
  }
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute);
  // A rolled-over component (`02-30`, `24:00`) is not a real point in time.
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute
  );
}

/** A finite number written without any surrounding or embedded whitespace, else `undefined`. */
function numberFromString(value: string): number | undefined {
  const parsed = Number(value);
  return value !== "" && !/\s/.test(value) && Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Orders a field value against the expected one for `gt`/`lt`: as datetimes
 * when both are in the datetime wire form, else as numbers. `undefined` when
 * either side is empty or the pair is not comparable, which matches neither.
 */
function compareOrdered(value: unknown, expected: unknown): number | undefined {
  if (typeof value !== "string" && typeof value !== "number") {
    return undefined;
  }
  if (isEmptyConditionValue(value) || isEmptyConditionValue(expected)) {
    return undefined;
  }
  if (isDatetime(value) && isDatetime(expected)) {
    // Same fixed-width format on both sides, so string order is time order.
    return value < expected ? -1 : value > expected ? 1 : 0;
  }
  const left = numberFromString(String(value));
  const right =
    typeof expected === "number"
      ? Number.isFinite(expected)
        ? expected
        : undefined
      : typeof expected === "string"
        ? numberFromString(expected)
        : undefined;
  return left === undefined || right === undefined ? undefined : Math.sign(left - right);
}
