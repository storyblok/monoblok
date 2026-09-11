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

/**
 * Field config accepted by {@link defineField}: the content-shape field plus the
 * DSL reference keys. `allow` replaces the wire `component_whitelist` /
 * `component_group_whitelist`, `deny` the wire `component_denylist` /
 * `component_group_denylist`; `datasource` holds the datasource ref/slug (the
 * wire `source` selector still passes through).
 */
export type FieldInput = Field & {
  allow?: BlockRef | FolderRef | readonly (BlockRef | FolderRef)[];
  /**
   * Blocks this field must not accept, by block ref/name or `defineFolder` ref.
   * The `Exclude` counterpart to `allow`: it narrows the field's content type and
   * `schema push` applies the matching editor restriction. Only `bloks` and
   * `richtext` fields have a denylist; anywhere else this throws.
   *
   * Use `deny` when you mean "everything except". It is the alternative to
   * `allow`, not an addition to it: the editor consults the denylist only when
   * the allow list is empty, so setting both is rejected rather than silently
   * reduced to the allow list alone.
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
 * strongly-typed identity helper: it validates only that the restriction keys can
 * reach the editor — `allow` and `deny` are mutually exclusive, and `deny` needs a
 * field type that has a denylist — and otherwise does not check the field.
 *
 * Use inside a {@link defineBlock} `fields` array — `pos` is injected from the
 * array index by `defineBlock`.
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
  field: TField,
): DefinedField<TName, TField>;
export function defineField(name: string, field: Record<string, unknown>): Record<string, unknown> {
  const { allow, deny, datasource, ...rest } = field;
  const normalized: Record<string, unknown> = { ...rest, name };
  const allowList = allow === undefined ? undefined : normalizeRestriction("allow", name, allow);
  const denyList = deny === undefined ? undefined : normalizeRestriction("deny", name, deny);
  // The editor consults a denylist only when the matching allow list is empty, so
  // a `deny` beside a non-empty `allow` never governs anything. Rejected rather
  // than dropped, for the same reason a `deny` on a field type without a denylist
  // is: the whole point of the key is to reach the editor, and config that cannot
  // is the bug it was added to fix. Say `allow` without the denied entries
  // instead. Empty lists restrict nothing, so they never conflict.
  if (allowList?.length && denyList?.length) {
    throw new Error(
      `defineField: "allow" and "deny" on field "${name}" cannot both be set; the editor ignores the denylist whenever the allow list is non-empty, so list only the blocks you want in "allow"`,
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
