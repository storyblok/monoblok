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
import type { Prettify } from '../utils/prettify';

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
/** A datasource reference for `datasource`: a defined datasource object or its slug. */
type DatasourceRef = string | { slug: string };

type NameOf<T> = T extends string ? T : T extends { name: infer N extends string } ? N : never;
type SlugOf<T> = T extends string ? T : T extends { slug: infer S extends string } ? S : never;

/** Normalizes an `allow` input (ref, name, or array thereof) to a tuple of block-name strings. */
type NormalizeAllow<T> = T extends readonly any[]
  ? { [I in keyof T]: NameOf<T[I]> }
  : readonly [NameOf<T>];

/**
 * Field config accepted by {@link defineField}: the content-shape field plus the
 * DSL reference keys. `allow` replaces the wire `component_whitelist`; `datasource`
 * holds the datasource ref/slug (the wire `source` selector still passes through).
 */
export type FieldInput = Field & {
  allow?: AllowRef | readonly AllowRef[];
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
    normalized.allow = refs.map(ref => (typeof ref === 'string' ? ref : (ref as { name: string })?.name));
  }
  if (datasource !== undefined) {
    normalized.datasource = typeof datasource === 'string' ? datasource : (datasource as { slug: string })?.slug;
  }
  return normalized;
}
