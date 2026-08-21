import { z } from "zod";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { SchemaBlockLike, SchemaFieldLike, SchemaLike } from "./shapes";
import type { ValidationIssue, ValidationResult } from "./types";
import {
  zAssetFieldValue,
  zMultilinkFieldValue,
  zRichTextFieldValue,
  zTableFieldValue,
} from "./internal-schemas";
import { isRecord, toValues } from "./shapes";
import { slugifyFolderPath } from "../utils/slugify-folder-path";

/** Field-content keys that are not user-defined fields. */
const RESERVED_KEYS = new Set(["_uid", "component", "_editable"]);

/** Separator the CMS puts between a field name and a locale for field-level translations. */
const I18N_SEPARATOR = "__i18n__";

/**
 * Strips the field-level translation suffix from a content key, e.g.
 * `headline__i18n__de` → `headline`. Field-level translations are stored as
 * siblings of the default value and belong to the same field definition, so the
 * suffix has to come off before the key is looked up in the block's fields.
 */
function baseFieldName(key: string): string {
  const index = key.indexOf(I18N_SEPARATOR);
  return index === -1 ? key : key.slice(0, index);
}

/**
 * Human descriptions of the accepted wire shape per field type, used when the
 * underlying validator can only report that the value as a whole is wrong (see
 * {@link formatValidatorMessage}).
 */
const EXPECTED_SHAPE = {
  asset: 'expected an asset object: { fieldtype: "asset", id, alt, filename }',
  multilink:
    'expected a link object: { fieldtype: "multilink", linktype: "story" | "url" | "email" | "asset", id, url, cached_url }',
  richtext: 'expected a richtext document: { type: "doc", content: [...] }',
  table: 'expected a table object: { fieldtype: "table", thead: [...], tbody: [...] }',
  plugin: 'expected a field plugin object carrying a "plugin" key',
} as const;

/**
 * Relaxed plugin envelope used by the `custom` case. Mirrors the generated
 * `zPluginFieldValue` but relaxes `_uid` from a UUID to a plain string, matching
 * the CMS, which persists arbitrary `_uid` strings. Kept local so a codegen
 * regenerate cannot revert it.
 */
const zPluginEnvelope = z.object({ plugin: z.string(), _uid: z.optional(z.string()) });

/**
 * Whether a content value counts as "no value". Mirrors the backend's required
 * check, which is `field_value.blank?`, and `''.blank?` is true. Applied
 * uniformly so one representation of unset cannot read as a type error on one
 * field type and as unset on another.
 */
function isUnset(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

/** Capitalizes and gives the text exactly one trailing period. */
function asSentence(text: string): string {
  const capitalized = text.charAt(0).toUpperCase() + text.slice(1);
  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

/** Validator messages that name nothing at all, and so are worth rewording. */
const UNINFORMATIVE_MESSAGES = new Set(["Invalid input."]);

/**
 * Said in place of a validator message that names nothing. Deliberately does not
 * borrow the field's expected shape: at a nested path that shape describes the
 * wrong thing (a richtext *node* is not a richtext *document*), so it would trade
 * a vague message for a misleading one.
 */
const VAGUE_MESSAGE = "Value does not match any shape this field accepts.";

/**
 * Maps a vague issue to where it sits, so {@link dropSubsumedIssues} can tell
 * whether anything else explains it. `path` is the issue's own path; `valueDepth`
 * is the depth of the field value it came from, which the scoping must never
 * reach above. Keyed weakly: every issue object is created once, for one call.
 */
const vagueIssueScopes = new WeakMap<
  ValidationIssue,
  {
    path: (string | number)[];
    valueDepth: number;
  }
>();

/**
 * Rewrites a validator's own message into the style the hand-written messages use.
 *
 * A validator says the least when the value as a whole fails (`atRoot`): Zod
 * reports a bare `Invalid input` for a failed union, every member having
 * mismatched so it can name none of them, which tells the reader nothing about
 * what a multilink or richtext value should look like. `expected` describes the
 * accepted shape and stands in for those.
 *
 * Deeper down, a message that names a key is kept verbatim, but one that names
 * nothing is reworded: `Invalid input.` gives a reader nothing to act on.
 */
function formatValidatorMessage(
  message: string,
  expected: string | undefined,
  atRoot: boolean,
): { message: string; vague: boolean } {
  const formatted = asSentence(message.trim());
  if (expected !== undefined && atRoot) {
    return { message: asSentence(expected), vague: false };
  }
  if (UNINFORMATIVE_MESSAGES.has(formatted)) {
    return { message: VAGUE_MESSAGE, vague: true };
  }
  return { message: formatted, vague: false };
}

/**
 * Joins a path into a comparable string. The separator is a NUL byte, which no
 * content key can contain, so a prefix match can only ever land on a whole
 * segment boundary.
 */
function pathKey(path: (string | number)[]): string {
  return path.join("\u0000");
}

/**
 * Drops vague issues that something else in the same field value already
 * explains.
 *
 * A malformed richtext blok reports twice: once as the vague failure the node's
 * union produces, once as the `unknown_component` the blok walk finds underneath
 * it, and only the second tells the reader what to fix. An empty asset object
 * likewise reports one vague issue per key that carries no message of its own,
 * alongside the keys that do name what is wrong.
 *
 * Scoped to the vague issue's own path, so a clear issue somewhere else never
 * suppresses it. Widened by one segment when the vague issue sits on an object
 * key, because a key carrying no message of its own says nothing next to a named
 * problem on the same object — the two describe one broken value. An array index
 * is never widened: elements are independent, so a malformed richtext node must
 * not be silenced by an unrelated node beside it. The widening also never reaches
 * above the field value itself, so a vague issue on one field survives a clear
 * issue on another.
 *
 * A vague issue that nothing else explains is always kept: a value is never
 * rejected silently.
 */
function dropSubsumedIssues(issues: ValidationIssue[]): ValidationIssue[] {
  const explanatoryPaths = issues
    .filter((issue) => !vagueIssueScopes.has(issue))
    .map((issue) => pathKey(issue.path));
  const hasIssueUnder = (path: (string | number)[]): boolean => {
    const prefix = `${pathKey(path)}\u0000`;
    return explanatoryPaths.some((candidate) => candidate.startsWith(prefix));
  };

  return issues.filter((issue) => {
    const scope = vagueIssueScopes.get(issue);
    if (scope === undefined) {
      return true;
    }
    if (hasIssueUnder(scope.path)) {
      return false;
    }
    const key = scope.path.at(-1);
    const widens = typeof key === "string" && scope.path.length > scope.valueDepth;
    return widens ? !hasIssueUnder(scope.path.slice(0, -1)) : true;
  });
}

/**
 * Maps a Standard Schema validator to a {@link ValidationIssue} reporter at `path`.
 * `expected` describes the accepted shape and is used when the validator's own
 * message carries no information (see {@link formatValidatorMessage}).
 */
function checkValue(
  schema: StandardSchemaV1,
  value: unknown,
  path: (string | number)[],
  entity: string,
  issues: ValidationIssue[],
  expected?: string,
): void {
  const result = schema["~standard"].validate(value);
  // `validateStory` is synchronous. The internal Zod schemas never return a
  // thenable, but a registered field plugin may ship an async validator — which
  // cannot be awaited here. Surface it as an error instead of silently passing,
  // which would report a false `ok: true`.
  if (result instanceof Promise) {
    issues.push({
      severity: "error",
      code: "async_validator_unsupported",
      path,
      entity,
      message:
        "Field plugin validator is asynchronous; validateStory runs synchronously and cannot await it.",
    });
    return;
  }
  if (result.issues) {
    for (const rawIssue of result.issues) {
      const issuePath = (rawIssue.path ?? []).map((segment) =>
        typeof segment === "object" && segment !== null
          ? String(segment.key)
          : (segment as string | number),
      );
      const { message, vague } = formatValidatorMessage(
        rawIssue.message,
        expected,
        issuePath.length === 0,
      );
      const issue: ValidationIssue = {
        severity: "error",
        code: "invalid_value",
        path: [...path, ...issuePath],
        entity,
        message,
      };
      if (vague) {
        vagueIssueScopes.set(issue, { path: issue.path, valueDepth: path.length });
      }
      issues.push(issue);
    }
  }
}

function validateFieldValue(
  field: SchemaFieldLike,
  value: unknown,
  blocksByName: Map<string, SchemaBlockLike>,
  fieldPluginsByType: Map<string, StandardSchemaV1>,
  path: (string | number)[],
  entity: string,
  issues: ValidationIssue[],
): void {
  switch (field.type) {
    case "asset":
      checkValue(zAssetFieldValue, value, path, entity, issues, EXPECTED_SHAPE.asset);
      break;
    case "multiasset":
      if (!Array.isArray(value)) {
        pushTypeIssue(value, "array", path, entity, issues);
        break;
      }
      value.forEach((item, index) =>
        checkValue(zAssetFieldValue, item, [...path, index], entity, issues, EXPECTED_SHAPE.asset),
      );
      checkCount(
        value.length,
        field.minimum_entries,
        field.maximum_entries,
        "asset(s)",
        path,
        entity,
        issues,
      );
      break;
    case "multilink":
      checkValue(zMultilinkFieldValue, value, path, entity, issues, EXPECTED_SHAPE.multilink);
      break;
    case "table":
      checkValue(zTableFieldValue, value, path, entity, issues, EXPECTED_SHAPE.table);
      break;
    case "richtext":
      checkValue(zRichTextFieldValue, value, path, entity, issues, EXPECTED_SHAPE.richtext);
      validateRichtextBloks(value, field, blocksByName, fieldPluginsByType, path, entity, issues);
      break;
    case "custom": {
      checkValue(zPluginEnvelope, value, path, entity, issues, EXPECTED_SHAPE.plugin);
      const validator = field.field_type ? fieldPluginsByType.get(field.field_type) : undefined;
      if (validator && isRecord(value)) {
        // Envelope keys sit alongside the plugin's own keys; strip them so the
        // plugin validator sees only its value. Sibling keys keep issue paths
        // accurate (an issue at ['color'] maps to [...path, 'color']).
        const { plugin: _plugin, _uid, ...pluginValue } = value;
        checkValue(validator, pluginValue, path, entity, issues);
      }
      break;
    }
    case "bloks":
      if (!Array.isArray(value)) {
        pushTypeIssue(value, "array", path, entity, issues);
        break;
      }
      checkCount(value.length, field.minimum, field.maximum, "block(s)", path, entity, issues);
      value.forEach((item, index) => {
        checkComponentAllowed(field, item, [...path, index], blocksByName, entity, issues);
        validateBlokContent(item, blocksByName, fieldPluginsByType, [...path, index], issues);
      });
      break;
    case "text":
    case "textarea":
    case "markdown":
      if (typeof value !== "string") {
        pushTypeIssue(value, "string", path, entity, issues);
        break;
      }
      checkStringLength(field, value, path, entity, issues);
      break;
    case "option":
      if (typeof value !== "string") {
        pushTypeIssue(value, "string", path, entity, issues);
        break;
      }
      checkDeclaredOption(field, value, path, entity, issues);
      break;
    case "datetime":
    // The legacy `image`/`file` types predate the asset object and store the
    // bare, protocol-relative URL as a string. There is nothing further to
    // constrain: `add_https` and the crop options shape the editor, not the
    // stored value.
    case "image":
    case "file":
      if (typeof value !== "string") {
        pushTypeIssue(value, "string", path, entity, issues);
      }
      break;
    case "number": {
      if (typeof value !== "string") {
        // The wire form of a number field is a string, so a JSON number is not
        // what the editor writes. Reported as a warning rather than an error: the
        // backend neither coerces nor rejects it, so API-authored and migrated
        // content carries it and still reads fine. It is drift worth surfacing,
        // not a broken value worth failing a build over.
        issues.push({
          severity: "warning",
          code: "invalid_value",
          path,
          entity,
          message: `Expected a numeric string (number fields are stored as strings), received ${describeType(value)}.`,
        });
        break;
      }
      // Mirrors the backend's `\A-?\d*\.?\d*\z`: an optional leading `-`, digits
      // and at most one `.`. Exponential notation is not accepted.
      if (!/^-?(?:\d+(?:\.\d*)?|\.\d*)?$/.test(value)) {
        pushConstraint(`Value "${value}" is not a numeric string.`, path, entity, issues);
        break;
      }
      const numeric = Number(value);
      // `''`, `'-'` and `'.'` satisfy the pattern but carry no value: an unset
      // number field stores `''`. There is nothing to range-check.
      if (value === "" || !Number.isFinite(numeric)) {
        break;
      }
      if (field.min_value != null && numeric < field.min_value) {
        pushConstraint(
          `Value ${value} is below the minimum of ${field.min_value}.`,
          path,
          entity,
          issues,
        );
      }
      if (field.max_value != null && numeric > field.max_value) {
        pushConstraint(
          `Value ${value} exceeds the maximum of ${field.max_value}.`,
          path,
          entity,
          issues,
        );
      }
      if (field.decimals != null && decimalPlaces(value) > field.decimals) {
        pushConstraint(
          `Value ${value} has more than ${field.decimals} decimal place(s).`,
          path,
          entity,
          issues,
        );
      }
      if (
        field.steps != null &&
        field.steps > 0 &&
        !isMultipleOf(numeric, field.steps, field.min_value ?? 0)
      ) {
        const base = field.min_value ?? 0;
        pushConstraint(
          `Value ${value} is not a multiple of the step ${field.steps}${base ? ` (offset from ${base})` : ""}.`,
          path,
          entity,
          issues,
        );
      }
      break;
    }
    case "boolean":
      if (typeof value !== "boolean") {
        pushTypeIssue(value, "boolean", path, entity, issues);
      }
      break;
    case "options":
      if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
        pushTypeIssue(value, "string[]", path, entity, issues);
        break;
      }
      checkCount(
        value.length,
        toCount(field.min_options),
        toCount(field.max_options),
        "option(s)",
        path,
        entity,
        issues,
      );
      value.forEach((item: string, index) =>
        checkDeclaredOption(field, item, [...path, index], entity, issues),
      );
      break;
    case "section":
    case "tab":
      // Layout-only field types carry no content value.
      break;
    default:
      // Exhaustiveness guard: when a new `FieldType` is added, this fails to
      // compile until the field type is handled (or explicitly skipped) above.
      field.type satisfies never;
      break;
  }
}

/**
 * Enforces a field's `allow` list for one embedded blok. Shared by the `bloks`
 * case and the richtext walk so both apply the same rule: `mapFieldToWire`
 * pushes folder/name `allow` as an editor/API restriction on *both* field types,
 * so validation must reject the same components the editor and API would.
 *
 * `itemPath` is the path to the blok item (its index); the reported issue points
 * at that item's `component` key. A component is allowed when it is named
 * directly in `allow` or its block sits in (or under) an allowed folder — both
 * sides canonicalized to slug space so a folder referenced two ways (a
 * `defineFolder` ref vs. a string shorthand with different casing/separators)
 * matches the way the CLI/editor group it.
 */
function checkComponentAllowed(
  field: SchemaFieldLike,
  item: unknown,
  itemPath: (string | number)[],
  blocksByName: Map<string, SchemaBlockLike>,
  entity: string,
  issues: ValidationIssue[],
): void {
  const allowEntries = field.allow ?? [];
  if (allowEntries.length === 0 || !isRecord(item) || typeof item.component !== "string") {
    return;
  }
  // A component the schema does not define at all is reported once as
  // `unknown_component` by validateBlokContent. Adding `disallowed_component`
  // for the same node would double-count one mistake and bury the real cause.
  if (!blocksByName.has(item.component)) {
    return;
  }
  const blockNamesAllowed = allowEntries.filter(
    (entry): entry is string => typeof entry === "string",
  );
  const folderPathsAllowed = allowEntries.filter(
    (entry): entry is { folder: string } =>
      typeof entry === "object" && entry !== null && typeof entry.folder === "string",
  );
  const itemBlock = blocksByName.get(item.component);
  const itemBlockFolder = itemBlock?.folder;
  const allowedByName = blockNamesAllowed.includes(item.component);
  const itemFolderSlug =
    typeof itemBlockFolder === "string" ? slugifyFolderPath(itemBlockFolder) : undefined;
  const allowedByFolder =
    itemFolderSlug !== undefined &&
    folderPathsAllowed.some(({ folder }) => {
      const allowedSlug = slugifyFolderPath(folder);
      return itemFolderSlug === allowedSlug || itemFolderSlug.startsWith(`${allowedSlug}/`);
    });
  if (!allowedByName && !allowedByFolder) {
    const allowedList = allowEntries
      .map((entry) => (typeof entry === "string" ? entry : `folder:${entry.folder}`))
      .join(", ");
    issues.push({
      severity: "error",
      code: "disallowed_component",
      path: [...itemPath, "component"],
      entity,
      message: `Component "${item.component}" is not allowed in field "${field.name}"; allowed: ${allowedList}.`,
    });
  }
}

/**
 * Reports a value that is not among a field's declared options — the drift left
 * behind when an option is renamed or removed from the schema while stories
 * still carry the old value.
 *
 * Only self-sourced fields can be checked. Every other `source` resolves its
 * options inside the space (`internal` from a datasource, `internal_stories`
 * from the story tree, `internal_languages` from the space languages, `external`
 * from a remote JSON URL), and a datasource definition deliberately carries no
 * entries — entries are content, not schema — so the accepted values are not
 * knowable here. An empty string is the unset form of an option field, not a
 * value, and a field declaring no options constrains nothing.
 */
function checkDeclaredOption(
  field: SchemaFieldLike,
  value: string,
  path: (string | number)[],
  entity: string,
  issues: ValidationIssue[],
): void {
  if (value === "" || (field.source !== undefined && field.source !== "")) {
    return;
  }
  const declared = (field.options ?? [])
    .map((option) => option.value)
    .filter(
      (optionValue): optionValue is string => typeof optionValue === "string" && optionValue !== "",
    );
  if (declared.length === 0 || declared.includes(value)) {
    return;
  }
  issues.push({
    severity: "error",
    code: "unknown_option",
    path,
    entity,
    message:
      `Value "${value}" is not one of the options declared for field "${field.name}": ` +
      `${declared.map((optionValue) => `"${optionValue}"`).join(", ")}.`,
  });
}

/** Reports a constraint (bound/length/count) violation as an error issue. */
function pushConstraint(
  message: string,
  path: (string | number)[],
  entity: string,
  issues: ValidationIssue[],
): void {
  issues.push({ severity: "error", code: "constraint_violation", path, entity, message });
}

/** Checks an array length against optional inclusive `min`/`max` bounds. */
function checkCount(
  length: number,
  min: number | undefined,
  max: number | undefined,
  noun: string,
  path: (string | number)[],
  entity: string,
  issues: ValidationIssue[],
): void {
  if (min != null && length < min) {
    pushConstraint(`Expected at least ${min} ${noun}, received ${length}.`, path, entity, issues);
  }
  if (max != null && length > max) {
    pushConstraint(`Expected at most ${max} ${noun}, received ${length}.`, path, entity, issues);
  }
}

/** Checks a string against optional `max_length`/`maxlength` and `minlength` bounds. */
function checkStringLength(
  field: SchemaFieldLike,
  value: string,
  path: (string | number)[],
  entity: string,
  issues: ValidationIssue[],
): void {
  const max = field.max_length ?? field.maxlength;
  if (max != null && value.length > max) {
    pushConstraint(
      `Text length ${value.length} exceeds the maximum of ${max}.`,
      path,
      entity,
      issues,
    );
  }
  if (field.minlength != null && value.length < field.minlength) {
    pushConstraint(
      `Text length ${value.length} is below the minimum of ${field.minlength}.`,
      path,
      entity,
      issues,
    );
  }
}

/**
 * Counts the fractional digits a numeric string actually carries. Counted off
 * the source text rather than via `Number`, so trailing zeros are preserved
 * (`'9.90'` → 2, where `Number('9.90')` would report 1).
 */
function decimalPlaces(value: string): number {
  const [, fraction] = value.split(".");
  return fraction?.length ?? 0;
}

/** Whether `value` lands on a `step` increment offset from `base`, with float tolerance. */
function isMultipleOf(value: number, step: number, base: number): boolean {
  const ratio = (value - base) / step;
  const tolerance = 1e-9 * Math.max(1, Math.abs(ratio));
  return Math.abs(ratio - Math.round(ratio)) <= tolerance;
}

/** Parses a numeric constraint stored as a string (e.g. `min_options`). Empty/non-numeric → undefined. */
function toCount(value: string | undefined): number | undefined {
  if (value == null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Names a received value's type for a message (`null` is reported as itself). */
function describeType(value: unknown): string {
  return value === null ? "null" : typeof value;
}

/** Reports an invalid field value with a caller-provided message. */
function pushInvalidValue(
  message: string,
  path: (string | number)[],
  entity: string,
  issues: ValidationIssue[],
): void {
  issues.push({ severity: "error", code: "invalid_value", path, entity, message });
}

function pushTypeIssue(
  value: unknown,
  expected: string,
  path: (string | number)[],
  entity: string,
  issues: ValidationIssue[],
): void {
  pushInvalidValue(`Expected ${expected}, received ${describeType(value)}.`, path, entity, issues);
}

/**
 * Walks richtext `content` nodes and validates embedded bloks (`type: 'blok'`).
 * `field` is the owning richtext field: each embedded blok is checked against its
 * `allow` list ({@link checkComponentAllowed}), matching the group/name
 * restriction `mapFieldToWire` pushes for richtext fields.
 */
function validateRichtextBloks(
  value: unknown,
  field: SchemaFieldLike,
  blocksByName: Map<string, SchemaBlockLike>,
  fieldPluginsByType: Map<string, StandardSchemaV1>,
  path: (string | number)[],
  entity: string,
  issues: ValidationIssue[],
): void {
  if (!isRecord(value) || !Array.isArray(value.content)) {
    return;
  }
  value.content.forEach((node, index) => {
    if (!isRecord(node)) {
      return;
    }
    if (node.type === "blok" && isRecord(node.attrs) && Array.isArray(node.attrs.body)) {
      node.attrs.body.forEach((blok, blokIndex) => {
        const blokPath = [...path, "content", index, "attrs", "body", blokIndex];
        checkComponentAllowed(field, blok, blokPath, blocksByName, entity, issues);
        validateBlokContent(blok, blocksByName, fieldPluginsByType, blokPath, issues);
      });
    } else if (Array.isArray(node.content)) {
      // Recurse into nested marks/nodes that may themselves embed bloks.
      validateRichtextBloks(
        node,
        field,
        blocksByName,
        fieldPluginsByType,
        [...path, "content", index],
        entity,
        issues,
      );
    }
  });
}

/** Validates a single blok content object against its component definition. */
function validateBlokContent(
  content: unknown,
  blocksByName: Map<string, SchemaBlockLike>,
  fieldPluginsByType: Map<string, StandardSchemaV1>,
  path: (string | number)[],
  issues: ValidationIssue[],
): void {
  if (!isRecord(content)) {
    issues.push({
      severity: "error",
      code: "invalid_content",
      path,
      entity: "story",
      message: "Expected a block content object.",
    });
    return;
  }

  const component = content.component;
  const block = typeof component === "string" ? blocksByName.get(component) : undefined;
  if (!block) {
    issues.push({
      severity: "error",
      code: "unknown_component",
      path: [...path, "component"],
      entity: "story",
      message: `Unknown component "${String(component)}".`,
    });
    return;
  }

  const entity = `block:${block.name}`;
  const fields = block.fields ?? [];
  const fieldsByName = new Map(fields.map((field) => [field.name, field]));

  // Translated keys are grouped under the field they belong to so the value loop
  // below can check each locale against the same field definition.
  const translatedKeysByField = new Map<string, string[]>();

  for (const key of Object.keys(content)) {
    if (RESERVED_KEYS.has(key)) {
      continue;
    }
    const fieldName = baseFieldName(key);
    if (!fieldsByName.has(fieldName)) {
      issues.push({
        severity: "warning",
        code: "unknown_field",
        path: [...path, key],
        entity,
        message: `Unknown field "${key}" on component "${block.name}".`,
      });
      continue;
    }
    if (key !== fieldName) {
      const translated = translatedKeysByField.get(fieldName);
      if (translated) {
        translated.push(key);
      } else {
        translatedKeysByField.set(fieldName, [key]);
      }
    }
  }

  for (const field of fields) {
    const value = content[field.name];
    // The backend's required check is `field_value.blank?`, and `''.blank?` is
    // true, so an empty string is unset rather than a value. That matters most
    // for `number`, whose unset wire form *is* `''` — the value branch below
    // legitimately skips it, leaving the required check as the only diagnostic.
    if (field.required && isUnset(value)) {
      issues.push({
        severity: "error",
        code: "missing_required_field",
        path: [...path, field.name],
        entity,
        message: `Missing required field "${field.name}" on component "${block.name}".`,
      });
    }
    // `''` counts as unset for every field type, matching the required check
    // above. Validating it as a value instead made the same content both unset
    // and wrongly typed depending on the field: `''` passed for `number` and
    // `datetime`, whose unset wire form it is, and failed for `boolean`, `asset`,
    // and `multilink`. Nothing is lost by skipping it, since an empty string
    // carries no value to be wrong about.
    else if (!isUnset(value)) {
      validateFieldValue(
        field,
        value,
        blocksByName,
        fieldPluginsByType,
        [...path, field.name],
        entity,
        issues,
      );
    }

    // A translated value is the same field in another locale, so it is held to
    // the same value rules. `required` stays scoped to the default value: a
    // locale nobody has translated yet is normal, not a missing value.
    for (const key of translatedKeysByField.get(field.name) ?? []) {
      const translatedValue = content[key];
      if (isUnset(translatedValue)) {
        continue;
      }
      validateFieldValue(
        field,
        translatedValue,
        blocksByName,
        fieldPluginsByType,
        [...path, key],
        entity,
        issues,
      );
    }
  }
}

/**
 * Validates a story's content against a schema without throwing. Reports unknown
 * components (error), unknown fields (warning), missing required fields (error),
 * invalid field-value shapes (error), and values outside a field's declared
 * options (error), recursing into nested `bloks` and richtext-embedded bloks.
 *
 * Field-level translations (`headline__i18n__de`) are validated against the
 * field they belong to, so a translated value is held to the same rules as the
 * default one and is not mistaken for an unknown field.
 *
 * @example
 * const result = validateStory(story, { blocks: { page, hero } });
 */
export function validateStory(story: unknown, schema: SchemaLike): ValidationResult {
  const issues: ValidationIssue[] = [];
  const blocksByName = new Map(toValues(schema.blocks).map((block) => [block.name, block]));
  const fieldPluginsByType = new Map(
    toValues(schema.fieldPlugins).map((plugin) => [plugin.fieldType, plugin.value]),
  );
  const content = isRecord(story) ? story.content : undefined;
  validateBlokContent(content, blocksByName, fieldPluginsByType, ["content"], issues);
  // One mistake should read as one issue. Suppression happens here, over the
  // whole story, because the specific issue often comes from a different walk
  // than the vague one it explains.
  const reported = dropSubsumedIssues(issues);
  return { ok: reported.every((issue) => issue.severity !== "error"), issues: reported };
}
