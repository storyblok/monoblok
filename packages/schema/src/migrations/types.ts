/**
 * Not exported from the package root. Whether content migrations belong in
 * `@storyblok/schema` at all is open — see the prototype design doc; the
 * subpath export exists so this can move without breaking a consumer's import.
 *
 * Type machinery for `defineMigration<Before, After>`: derives the addressable
 * block names and `block.field` paths from a `@storyblok/schema` schema type.
 */
import type { Block, BlockContent } from "../index";

/** The `blocks`/`fieldPlugins` members of a `Schema<typeof schema>`. */
export interface SchemaShape {
  blocks: Block;
  fieldPlugins: unknown;
}

/**
 * Field types that carry no content value. They exist only to lay out the
 * editor form, so addressing one in a migration can never do anything.
 */
export type NonContentFieldType = "section" | "tab";

/** The fields of a block that actually hold a content value. */
type ContentFields<TBlock extends Block> = Exclude<
  TBlock["fields"][number],
  { type: NonContentFieldType }
>;

export type BlockNameOf<TSchema extends SchemaShape> = TSchema["blocks"]["name"];

export type BlockByName<TSchema extends SchemaShape, TName extends BlockNameOf<TSchema>> = Extract<
  TSchema["blocks"],
  { name: TName }
>;

/** Field names of one block, excluding the layout-only pseudo fields. */
export type FieldNameIn<
  TSchema extends SchemaShape,
  TName extends BlockNameOf<TSchema>,
> = ContentFields<BlockByName<TSchema, TName>>["name"] & string;

/** `"<block>.<field>"` for every block/content-field pair in the schema. */
export type FieldPathOf<TSchema extends SchemaShape> = Extract<
  {
    [B in TSchema["blocks"] as B["name"]]: `${B["name"] & string}.${ContentFields<B>["name"] & string}`;
  }[BlockNameOf<TSchema>],
  string
>;

/** Field paths that exist on one specific block. */
export type FieldPathIn<
  TSchema extends SchemaShape,
  TName extends BlockNameOf<TSchema>,
> = `${TName & string}.${FieldNameIn<TSchema, TName>}`;

/** The block half of a `"block.field"` path. */
export type BlockOfPath<TPath extends string> = TPath extends `${infer B}.${string}` ? B : never;

/** The field half of a `"block.field"` path. */
export type FieldOfPath<TPath extends string> = TPath extends `${string}.${infer F}` ? F : never;

/** Content shape of one block, with nested `bloks` resolved against the registry. */
export type ContentOf<
  TSchema extends SchemaShape,
  TName extends BlockNameOf<TSchema>,
> = BlockContent<BlockByName<TSchema, TName>, TSchema["blocks"], TSchema["fieldPlugins"]>;

/** Value type of one `"block.field"` path. */
export type ValueOfPath<TSchema extends SchemaShape, TPath extends FieldPathOf<TSchema>> =
  BlockOfPath<TPath> extends BlockNameOf<TSchema>
    ? FieldOfPath<TPath> extends keyof ContentOf<TSchema, BlockOfPath<TPath>>
      ? ContentOf<TSchema, BlockOfPath<TPath>>[FieldOfPath<TPath>]
      : never
    : never;

/**
 * A rename/move target on the *post*-migration schema: the names the block is
 * declared to have after the migration ran, minus the source name itself.
 *
 * Falls back to `string` when the block is absent from the target schema, so a
 * migration whose `After` snapshot is incomplete still compiles.
 */
export type TargetFieldName<TAfter extends SchemaShape, TBlock extends string> =
  TBlock extends BlockNameOf<TAfter> ? FieldNameIn<TAfter, TBlock> : string;

/**
 * True when the caller gave `defineMigration` one schema rather than two.
 *
 * With two, `Before` is a frozen snapshot and reads can be exact. With one, the
 * same type has to describe both ends, so a field the migration reads and then
 * renames away is absent from it — the read has to widen or the common case
 * would not compile.
 */
export type IsSingleSchema<TAfter, TBefore> = [TAfter] extends [TBefore]
  ? [TBefore] extends [TAfter]
    ? true
    : false
  : false;

/**
 * A name the migration reads. Exact under two schemas; under one it keeps
 * autocomplete for surviving names while still accepting a name the schema no
 * longer has.
 */
export type SourceBlockName<TAfter extends SchemaShape, TBefore extends SchemaShape> =
  IsSingleSchema<TAfter, TBefore> extends true
    ? BlockNameOf<TBefore> | (string & {})
    : BlockNameOf<TBefore>;

/** Field names of a source block, widened on the same rule as `SourceBlockName`. */
export type SourceFieldName<
  TAfter extends SchemaShape,
  TBefore extends SchemaShape,
  TBlock extends string,
> =
  TBlock extends BlockNameOf<TBefore>
    ? IsSingleSchema<TAfter, TBefore> extends true
      ? FieldNameIn<TBefore, TBlock> | (string & {})
      : FieldNameIn<TBefore, TBlock>
    : string;
