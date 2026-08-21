import type {
  AssetFieldValue,
  BlockContent,
  BlockContentInput,
  BlocksFieldValue,
  Field,
  FieldType,
  FieldValue,
  FieldValueInput,
  MultilinkFieldValue,
  PluginFieldValue,
  RichTextFieldValue,
  RichtextFieldValue,
  TableFieldValue,
} from "../generated/types/field";
import type { BlockFolder } from "./define-folder";
import type { Prettify } from "../utils/prettify";
import { isRecord } from "../utils/is-record";

export type {
  AssetFieldValue,
  BlockContent,
  BlockContentInput,
  BlocksFieldValue,
  Field,
  FieldType,
  FieldValue,
  FieldValueInput,
  MultilinkFieldValue,
  PluginFieldValue,
  RichTextFieldValue,
  RichtextFieldValue,
  TableFieldValue,
};

/** A block reference for `allow`/`deny`: a defined block object or its name. */
type BlockRef = string | { name: string };
/** A folder reference for `allow`/`deny`: a defined folder object (no string shorthand — bare strings are block names). */
type FolderRef = BlockFolder;
/** A datasource reference for `datasource`: a defined datasource object or its slug. */
type DatasourceRef = string | { slug: string };

type NameOf<T> = T extends string ? T : T extends { name: infer N extends string } ? N : never;
type SlugOf<T> = T extends string ? T : T extends { slug: infer S extends string } ? S : never;

/** Normalizes a single `allow`/`deny` entry: folder refs to `{ folder: path }`, everything else to a name string. */
type NormalizeRestrictionEntry<T> = T extends { path: infer P extends string }
  ? { folder: P }
  : NameOf<T>;
/** Normalizes an `allow`/`deny` input (ref, name, or array thereof) to a tuple of normalized entries. */
type NormalizeRestriction<T> = T extends readonly any[]
  ? { [I in keyof T]: NormalizeRestrictionEntry<T[I]> }
  : readonly [NormalizeRestrictionEntry<T>];

/** Type guard for a defined folder ref: has `path`, and never `fields` (defined block) or `slug` (datasource). */
const isFolderRef = (ref: unknown): ref is BlockFolder =>
  isRecord(ref) && typeof ref.path === "string" && !Array.isArray(ref.fields) && !("slug" in ref);

/** Whether a normalized `allow`/`deny` list restricts by folder rather than by block name. */
const isFolderList = (entries: readonly unknown[]): boolean =>
  entries.some((entry) => isRecord(entry) && typeof entry.folder === "string");

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
 * Normalizes an `allow`/`deny` input to plain block names and `{ folder: path }`
 * entries. The editor restricts by either blocks or folders, not both, so a list
 * mixing the two would leave part of itself inert and throws instead.
 */
function normalizeRestriction(key: string, name: string, input: unknown): unknown[] {
  const refs = Array.isArray(input) ? input : [input];
  const folderRefs = refs.filter(isFolderRef);
  if (folderRefs.length > 0 && folderRefs.length < refs.length) {
    throw new Error(
      `defineField: "${key}" on field "${name}" mixes block and folder references; the editor restricts by either blocks or folders, not both`,
    );
  }
  return refs.map((ref) =>
    isFolderRef(ref)
      ? { folder: ref.path }
      : typeof ref === "string"
        ? ref
        : isRecord(ref)
          ? ref.name
          : undefined,
  );
}

/** The wire restriction keys {@link FieldInput} redeclares, so it owns their docs. */
type WireRestrictionKeys =
  | "component_whitelist"
  | "component_group_whitelist"
  | "component_denylist"
  | "component_group_denylist"
  | "component_tag_whitelist"
  | "component_tag_denylist"
  | "restrict_components"
  | "restrict_type";

/**
 * The documented declarations of the wire restriction keys, the single site that
 * carries their `@deprecated` tags.
 *
 * Redeclaring them in an intersection while `Field` still declares them would
 * silently drop those tags: TypeScript reports a property as deprecated only when
 * *every* declaration of it carries the tag, so the untagged `Field` declaration
 * would cancel the tagged one out (verified on TS 6.0.3 and 5.8.3, for
 * intersections and unions alike, in either order). {@link FieldInput} therefore
 * strips them from each variant with `Omit` and picks them back from here.
 */
type WireRestrictionDocs = {
  /**
   * @deprecated Use `allow` instead: it takes block names or `defineBlock` refs
   * and derives `restrict_components` / `restrict_type` for you. On `bloks` and
   * `richtext` fields a bare `component_whitelist` without those flags is
   * ignored by the editor, and if you set both, `allow` wins.
   *
   * @example
   * defineField('body', { type: 'bloks', allow: ['teaser', heroBlock] });
   */
  component_whitelist?: string[];
  /**
   * @deprecated Use `allow` with `defineFolder` refs instead. Folder paths are
   * resolved to component group uuids at push time, and the restriction flags
   * are derived for you.
   *
   * @example
   * const heros = defineFolder({ name: 'Heros', parent: layout });
   * defineField('body', { type: 'bloks', allow: [heros] });
   */
  component_group_whitelist?: string[];
  /**
   * @deprecated Use `deny` instead: it takes block names or `defineBlock` refs,
   * narrows the field's content type, and derives the wire flags for you.
   *
   * @example
   * defineField('body', { type: 'bloks', deny: ['banner'] });
   */
  component_denylist?: string[];
  /**
   * @deprecated Use `deny` with `defineFolder` refs instead. Folder paths are
   * resolved to component group uuids at push time, and the restriction flags
   * are derived for you.
   *
   * @example
   * const legacy = defineFolder({ name: 'Legacy' });
   * defineField('body', { type: 'bloks', deny: [legacy] });
   */
  component_group_denylist?: string[];
  /**
   * @deprecated Derived from `allow` / `deny`: you should not set it by hand.
   *
   * To leave a field unrestricted, omit `allow` entirely rather than setting
   * `false`: a field with no whitelist is already unrestricted. This flag only
   * exists to represent legacy spaces that stored a whitelist with the
   * restriction switched off; `schema init` drops that stale whitelist, so
   * deleting this line is safe and behaviourally identical.
   */
  restrict_components?: boolean;
  /**
   * Ids of the block tags this field accepts. Requires `restrict_type: 'tags'`,
   * the one restriction dimension with no `allow` equivalent, so this key has no
   * DSL replacement and is not discouraged.
   */
  component_tag_whitelist?: number[];
  /**
   * Ids of the block tags this field rejects. Requires `restrict_type: 'tags'`,
   * the one restriction dimension with no `deny` equivalent, so this key has no
   * DSL replacement and is not discouraged.
   */
  component_tag_denylist?: number[];
  /**
   * Selects which restriction dimension the editor reads: `'groups'` for the
   * component group lists, `'tags'` for the tag lists, and `''` (or
   * `'components'`) for the block-name lists. `allow` / `deny` derive it for the
   * group and name dimensions, so set it by hand only for `'tags'`, the one
   * dimension with no DSL equivalent.
   */
  restrict_type?: string;
};

/**
 * Every DSL reference key. Scoped to the keys a given variant can act on by
 * {@link DslInputFor}, so this type is never used whole.
 */
type DslInputAll = {
  allow?: BlockRef | FolderRef | readonly (BlockRef | FolderRef)[];
  /**
   * Blocks this field must not accept, by block ref/name or `defineFolder` ref.
   * The `Exclude` counterpart to `allow`: it narrows the field's content type and
   * `schema push` applies the matching editor restriction. Only `bloks` and
   * `richtext` fields have a denylist; anywhere else this throws.
   *
   * The editor restricts by either blocks or folders, never both, so `allow` and
   * `deny` on one field must not disagree on which. Where they agree, the editor
   * gives `allow` precedence: a non-empty allow list decides on its own and
   * leaves `deny` inert, so reach for `deny` when you mean "everything except".
   *
   * A denial governs the block picker, not the stored content. Pasting a block
   * from the clipboard is checked against the allow list only, so a denied block
   * can still be pasted in. Treat `deny` as authoring guidance rather than a
   * boundary, and use `allow` where a block genuinely must never appear.
   */
  deny?: BlockRef | FolderRef | readonly (BlockRef | FolderRef)[];
  datasource?: DatasourceRef;
  required?: boolean;
};

/**
 * The DSL reference keys the matched variant can act on.
 *
 * Derived from the wire keys each one replaces rather than from a hand-kept list
 * of field types, so a spec change cannot leave the two out of step. `allow`
 * needs a `component_whitelist` to map onto, which `bloks` and `richtext` have
 * for nested blocks and `multilink` has for story content types. `deny` needs a
 * `component_denylist`, which only the two block-picker types have. `datasource`
 * needs a `datasource_slug`.
 *
 * Scoping them matters: a reference key on a field type that has no wire key to
 * map it onto is exactly the dead-key defect this helper exists to reject, so
 * exempting all three on every variant would leave a hole in the middle of the
 * check.
 *
 * `name` and `required` stay universal. `defineField` stamps `name` itself, and
 * the layout-only `section`/`tab` variants do not declare `required`.
 */
type DslKeysFor<TVariant> =
  | "name"
  | "required"
  | ("component_whitelist" extends keyof TVariant ? "allow" : never)
  | ("component_denylist" extends keyof TVariant ? "deny" : never)
  | ("datasource_slug" extends keyof TVariant ? "datasource" : never);

/** {@link DslInputAll} narrowed to the keys `TVariant` can act on. */
type DslInputFor<TVariant> = Pick<DslInputAll, Extract<DslKeysFor<TVariant>, keyof DslInputAll>>;

/**
 * Field config accepted by {@link defineField}: the content-shape field plus the
 * DSL reference keys. `allow` replaces the wire `component_whitelist` /
 * `component_group_whitelist`, `deny` the wire `component_denylist` /
 * `component_group_denylist`; `datasource` holds the datasource ref/slug (the
 * wire `source` selector still passes through).
 *
 * The wire restriction keys stay legal as a lower-level escape hatch, but they
 * cannot be combined with `allow` / `deny` on one field: see
 * {@link NoRestrictionConflict}.
 *
 * Built one `Field` variant at a time, re-picking only the wire restriction keys
 * that variant actually declares. Grafting all of them onto *every* variant would
 * put `FieldInput` at odds with {@link NoExtraKeys}, which checks against the
 * matched variant: `FieldInput`'s own `text` member would carry
 * `component_whitelist`, which `text` does not own, so `FieldInput` would fail its
 * own check and `defineField` would reject its documented input type.
 */
export type FieldInput = FieldInputOf<Field>;

type FieldInputOf<T> = T extends any
  ? Omit<T, WireRestrictionKeys> &
      Pick<WireRestrictionDocs, Extract<WireRestrictionKeys, keyof T>> &
      DslInputFor<T>
  : never;

declare const invalidKey: unique symbol;
/**
 * Unsatisfiable placeholder whose type argument carries `TReason` into the
 * compiler error, so a rejected key explains itself at the call site. Not
 * exported, so nothing can construct a value that satisfies it.
 */
type Invalid<TReason extends string> = { readonly [invalidKey]: TReason };

/**
 * Wire restriction keys that `allow` / `deny` replace and derive the flags for.
 * `validateSchema` reports the same conflict {@link NoRestrictionConflict} rejects,
 * for consumers without type checking, so the two read from one list.
 */
export const DERIVED_RESTRICTION_KEYS = [
  "component_whitelist",
  "component_group_whitelist",
  "component_denylist",
  "component_group_denylist",
  "restrict_components",
] as const;

type DerivedRestrictionKeys = (typeof DERIVED_RESTRICTION_KEYS)[number];

/** The {@link Field} union member matching `T`'s `type` discriminant. */
type MemberFor<T> = T extends { type: infer TType } ? Extract<Field, { type: TType }> : Field;

/**
 * Rejects keys the matched {@link Field} variant does not own, so a typo or an
 * option belonging to a different field type is a compile error instead of a
 * silent no-op on the wire.
 *
 * The generic signature alone cannot do this: the field literal is *inferred as*
 * the type parameter, so excess property checking has no concrete target to fire
 * against. Intersecting this mapped type supplies one.
 *
 * `type: 'custom'` is exempt because plugin option keys pass through to the
 * Management API verbatim, so arbitrary keys are legitimate there.
 */
type NoExtraKeys<T> = T extends { type: "custom" }
  ? unknown
  : {
      [K in Exclude<
        keyof T,
        keyof MemberFor<T> | DslKeysFor<MemberFor<T>>
      >]: Invalid<`unknown option "${K & string}" for this field type`>;
    };

/**
 * Rejects the wire restriction keys on a field that also uses `allow` / `deny`.
 * `schema push` derives them from the DSL keys and overwrites whatever was set by
 * hand, so setting both is always a mistake: pick the DSL keys or the raw ones.
 *
 * Matched against `{}` rather than `unknown`, because a present-but-`undefined`
 * property satisfies `{ allow: unknown }`. A conditionally-built `allow` that
 * resolves to `undefined` derives nothing at runtime, so it must not make the raw
 * key a conflict.
 */
type NoRestrictionConflict<T> = T extends { allow: {} } | { deny: {} }
  ? {
      [K in Extract<keyof T, DerivedRestrictionKeys>]: Invalid<`"${K &
        string}" is derived from "allow"/"deny": set one or the other, not both`>;
    }
  : unknown;

/**
 * A field literal plus the two option checks {@link defineField} applies.
 *
 * Needed to write a wrapper around `defineField`. The checks are mapped types
 * over the type parameter, and TypeScript cannot prove `T` satisfies a mapped
 * type of itself for an unresolved `T`, so forwarding a still-generic field is a
 * compile error. Declaring the wrapper's own parameter as `CheckedField<T>`
 * fixes that, and moves the check out to the wrapper's call site, which is where
 * the literal is actually written and where the error belongs.
 *
 * @example
 * function textField<const T extends FieldInput>(name: string, field: CheckedField<T>) {
 *   return defineField(name, field);
 * }
 */
export type CheckedField<TField extends FieldInput> = TField &
  NoExtraKeys<TField> &
  NoRestrictionConflict<TField>;

/** Result of {@link defineField}: the field stamped with `name`, with refs normalized to strings. */
export type DefinedField<TName extends string, TField extends FieldInput> = Prettify<
  Omit<TField, "allow" | "deny" | "datasource" | "name"> & { name: TName } & (TField extends {
      allow: infer A;
    }
      ? { allow: NormalizeRestriction<A> }
      : unknown) &
    (TField extends { deny: infer D } ? { deny: NormalizeRestriction<D> } : unknown) &
    (TField extends { datasource: infer D } ? { datasource: SlugOf<D> } : unknown)
>;

/**
 * Returns a {@link Field} stamped with the given `name`, normalizing reference
 * keys to strings so everything downstream sees plain names/slugs. A thin,
 * strongly-typed identity helper: it validates only that `allow` and `deny` pick
 * a single restriction dimension, and otherwise does not check the field.
 *
 * Options are checked against the field type: a key the given `type` does not own
 * is a compile error (see {@link NoExtraKeys}), as is mixing `allow` / `deny` with
 * the wire restriction keys they derive (see {@link NoRestrictionConflict}).
 *
 * Use inside a {@link defineBlock} `fields` array — `pos` is injected from the
 * array index by `defineBlock`. To wrap this function in one of your own, type
 * its field parameter as {@link CheckedField}; a bare generic cannot be forwarded.
 *
 * @example
 * defineField('headline', { type: 'text', max_length: 100, required: true });
 * defineField('body', { type: 'bloks', allow: [heroBlock, 'teaser'] });
 * defineField('body', { type: 'bloks', deny: ['banner'] });
 * defineField('body', { type: 'bloks', deny: [legacyFolder] });
 * defineField('theme', { type: 'option', source: 'internal', datasource: colors });
 */
export function defineField<const TName extends string, const TField extends FieldInput>(
  name: TName,
  field: CheckedField<TField>,
): DefinedField<TName, TField>;
export function defineField(name: string, field: Record<string, unknown>): Record<string, unknown> {
  const { allow, deny, datasource, ...rest } = field;
  const normalized: Record<string, unknown> = { ...rest, name };
  const allowList = allow === undefined ? undefined : normalizeRestriction("allow", name, allow);
  const denyList = deny === undefined ? undefined : normalizeRestriction("deny", name, deny);
  // The editor picks one restriction dimension per field, so an `allow` that
  // restricts by folder alongside a `deny` that restricts by block name (or the
  // reverse) would silently drop one of the two lists. Empty lists carry no
  // dimension, so they never conflict.
  if (allowList?.length && denyList?.length && isFolderList(allowList) !== isFolderList(denyList)) {
    throw new Error(
      `defineField: "allow" and "deny" on field "${name}" mix block and folder references; the editor restricts by either blocks or folders, not both`,
    );
  }
  // Rejected rather than dropped: a `deny` the editor cannot read is the bug this
  // key was added to fix, so failing loudly beats writing a dead wire key that
  // round-trips and looks intentional.
  if (denyList?.length && !DENIABLE_FIELD_TYPES.includes(String(rest.type))) {
    throw new Error(
      `defineField: "deny" on field "${name}" has no effect on a "${String(rest.type)}" field; only ${DENIABLE_FIELD_TYPES.join(" and ")} fields have a block denylist`,
    );
  }
  if (allowList !== undefined) {
    normalized.allow = allowList;
  }
  if (denyList !== undefined) {
    normalized.deny = denyList;
  }
  if (datasource !== undefined) {
    normalized.datasource =
      typeof datasource === "string"
        ? datasource
        : isRecord(datasource)
          ? datasource.slug
          : undefined;
  }
  return normalized;
}
