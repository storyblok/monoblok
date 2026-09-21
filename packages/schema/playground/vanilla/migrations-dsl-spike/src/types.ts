/**
 * SPIKE — prototype quality. Not a shipped API.
 *
 * Type machinery for `defineMigration<Schema>`: derives the addressable block
 * names and `block.field` paths from a `@storyblok/schema` schema type.
 */
import type { Block, BlockContent } from "@storyblok/schema";

/** The `blocks`/`fieldPlugins` members of a `Schema<typeof schema>`. */
export interface SchemaShape {
  blocks: Block;
  fieldPlugins: unknown;
}

export type BlockNameOf<TSchema extends SchemaShape> = TSchema["blocks"]["name"];

export type BlockByName<TSchema extends SchemaShape, TName extends BlockNameOf<TSchema>> = Extract<
  TSchema["blocks"],
  { name: TName }
>;

/** `"<block>.<field>"` for every block/field pair in the schema. */
export type FieldPathOf<TSchema extends SchemaShape> = Extract<
  {
    [B in TSchema["blocks"] as B["name"]]: `${B["name"] & string}.${B["fields"][number]["name"] & string}`;
  }[BlockNameOf<TSchema>],
  string
>;

/** Field paths that exist on one specific block. */
export type FieldPathIn<
  TSchema extends SchemaShape,
  TName extends BlockNameOf<TSchema>,
> = `${TName & string}.${BlockByName<TSchema, TName>["fields"][number]["name"] & string}`;

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
 * Field names a rename may target: any name not already used by the block.
 * `string & {}` keeps the union open for autocomplete without rejecting new names.
 */
export type NewFieldName<TSchema extends SchemaShape, TPath extends FieldPathOf<TSchema>> = Exclude<
  string,
  FieldOfPath<FieldPathIn<TSchema, BlockOfPath<TPath> & BlockNameOf<TSchema>>>
>;
