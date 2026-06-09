import type {
  ComponentCreate,
  Component as ComponentGenerated,
  ComponentUpdate,
  Field,
} from './_sources';

export type { ComponentCreate, ComponentUpdate };

type Prettify<T> = { [K in keyof T]: T[K] } & {};

/** Replaces the keys of `T` that also appear in `U` with the definitions from `U`. */
type Override<T, U> = Prettify<Omit<T, keyof U> & U>;

/** Input form: an ordered array of named fields. The array index becomes `pos`. */
export type BlockSchemaInput = ReadonlyArray<Field & { name: string; required?: boolean }>;

/** Wire form: the MAPI object map keyed by field name. This is what `defineBlock` returns. */
export type BlockSchema = Record<string, Field & { required?: boolean }>;

/** Converts an array-form schema input into the wire-shape object map at the type level. */
export type SchemaArrayToRecord<T extends BlockSchemaInput> = {
  [F in T[number] as F['name']]: Omit<F, 'name'>;
};

/** A Storyblok block. */
export type Block<
  TName extends string = string,
  TBlockSchema extends BlockSchema = BlockSchema,
  TIsRoot extends boolean = boolean,
  TIsNestable extends boolean = boolean,
  TComponentGroupUuid extends string | null = string | null,
> = Override<ComponentGenerated, {
  name: TName;
  schema: TBlockSchema;
  is_root?: TIsRoot;
  is_nestable?: TIsNestable;
  component_group_uuid?: TComponentGroupUuid;
}>;

/**
 * A root {@link Block} (`is_root: true`). Given a union of blocks, narrows to
 * its root members; with no argument it is the generic root-block type.
 */
export type RootBlock<T extends Block = Block & { is_root: true }> =
  Extract<T, { is_root: true }>;

/**
 * A nestable {@link Block} (`is_nestable: true`). Given a union of blocks,
 * narrows to its nestable members; with no argument it is the generic
 * nestable-block type.
 */
export type NestableBlock<T extends Block = Block & { is_nestable: true }> =
  Extract<T, { is_nestable: true }>;
