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
  RichtextFieldValue,
  TableFieldValue,
} from '../generated/types/field';
import type { BlockFolder } from './define-folder';
import type { Prettify } from '../utils/prettify';
import { isRecord } from '../utils/is-record';

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
  RichtextFieldValue,
  TableFieldValue,
};

/** A block reference for `allow`: a defined block object or its name. */
type AllowRef = string | { name: string };
/** A folder reference for `allow`: a defined folder object (no string shorthand — bare strings are block names). */
type FolderAllowRef = BlockFolder;
/** A datasource reference for `datasource`: a defined datasource object or its slug. */
type DatasourceRef = string | { slug: string };

type NameOf<T> = T extends string ? T : T extends { name: infer N extends string } ? N : never;
type SlugOf<T> = T extends string ? T : T extends { slug: infer S extends string } ? S : never;

/** Normalizes a single `allow` entry: folder refs to `{ folder: path }`, everything else to a name string. */
type NormalizeAllowEntry<T> = T extends { path: infer P extends string }
  ? { folder: P }
  : NameOf<T>;
/** Normalizes an `allow` input (ref, name, or array thereof) to a tuple of normalized entries. */
type NormalizeAllow<T> = T extends readonly any[]
  ? { [I in keyof T]: NormalizeAllowEntry<T[I]> }
  : readonly [NormalizeAllowEntry<T>];

/** Type guard for a defined folder ref: has `path`, and never `fields` (defined block) or `slug` (datasource). */
const isFolderRef = (ref: unknown): ref is BlockFolder =>
  isRecord(ref) && typeof ref.path === 'string' && !Array.isArray(ref.fields) && !('slug' in ref);

/**
 * Field config accepted by {@link defineField}: the content-shape field plus the
 * DSL reference keys. `allow` replaces the wire `component_whitelist`; `datasource`
 * holds the datasource ref/slug (the wire `source` selector still passes through).
 */
export type FieldInput = Field & {
  allow?: AllowRef | FolderAllowRef | readonly (AllowRef | FolderAllowRef)[];
  datasource?: DatasourceRef;
  required?: boolean;
};

/** Result of {@link defineField}: the field stamped with `name`, with refs normalized to strings. */
export type DefinedField<TName extends string, TField extends FieldInput> = Prettify<
  Omit<TField, 'allow' | 'datasource' | 'name'>
  & { name: TName }
  & (TField extends { allow: infer A } ? { allow: NormalizeAllow<A> } : unknown)
  & (TField extends { datasource: infer D } ? { datasource: SlugOf<D> } : unknown)
>;

/**
 * Returns a {@link Field} stamped with the given `name`, normalizing reference
 * keys to strings so everything downstream sees plain names/slugs. A thin,
 * strongly-typed identity helper — it does not validate or throw.
 *
 * Use inside a {@link defineBlock} `fields` array — `pos` is injected from the
 * array index by `defineBlock`.
 *
 * @example
 * defineField('headline', { type: 'text', max_length: 100, required: true });
 * defineField('body', { type: 'bloks', allow: [heroBlock, 'teaser'] });
 * defineField('theme', { type: 'option', source: 'internal', datasource: colors });
 */
export function defineField<
  const TName extends string,
  const TField extends FieldInput,
>(name: TName, field: TField): DefinedField<TName, TField>;
export function defineField(name: string, field: Record<string, unknown>): Record<string, unknown> {
  const { allow, datasource, ...rest } = field;
  const normalized: Record<string, unknown> = { ...rest, name };
  if (allow !== undefined) {
    const refs = Array.isArray(allow) ? allow : [allow];
    const folderRefs = refs.filter(isFolderRef);
    if (folderRefs.length > 0 && folderRefs.length < refs.length) {
      throw new Error(`defineField: "allow" on field "${name}" mixes block and folder references; the editor restricts by either blocks or folders, not both`);
    }
    normalized.allow = refs.map(ref =>
      isFolderRef(ref)
        ? { folder: ref.path }
        : (typeof ref === 'string' ? ref : isRecord(ref) ? ref.name : undefined),
    );
  }
  if (datasource !== undefined) {
    normalized.datasource = typeof datasource === 'string' ? datasource : isRecord(datasource) ? datasource.slug : undefined;
  }
  return normalized;
}
