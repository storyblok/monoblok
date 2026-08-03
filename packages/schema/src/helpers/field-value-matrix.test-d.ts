import type { SbRichTextInput } from '@storyblok/richtext';
import { describe, expectTypeOf, it } from 'vitest';
import type { BlockContentBase } from '../generated/overlay/_internal.gen';
import type {
  AssetFieldValue,
  FieldValue,
  FieldValueInput,
  MultilinkFieldValue,
  PluginFieldValue,
  RichtextFieldValue,
  TableFieldValue,
} from '../generated/types/field';
import { defineField } from './define-field';

/**
 * One assertion per Storyblok field type, covering the full `FieldTypeValueMap`.
 *
 * `FieldValue` is the contract every consumer of a schema depends on, and the map
 * behind it is hand-maintained rather than derived from the OpenAPI spec — a
 * regenerate can silently change a mapping. Asserting all 17 types here makes the
 * map's exhaustiveness reviewable and turns any drift into a failing typecheck.
 */
const _f = {
  text: defineField('a', { type: 'text' }),
  textarea: defineField('a', { type: 'textarea' }),
  richtext: defineField('a', { type: 'richtext' }),
  markdown: defineField('a', { type: 'markdown' }),
  number: defineField('a', { type: 'number' }),
  datetime: defineField('a', { type: 'datetime' }),
  boolean: defineField('a', { type: 'boolean' }),
  option: defineField('a', { type: 'option' }),
  options: defineField('a', { type: 'options' }),
  asset: defineField('a', { type: 'asset' }),
  multiasset: defineField('a', { type: 'multiasset' }),
  multilink: defineField('a', { type: 'multilink' }),
  bloks: defineField('a', { type: 'bloks' }),
  table: defineField('a', { type: 'table' }),
  section: defineField('a', { type: 'section' }),
  tab: defineField('a', { type: 'tab' }),
  custom: defineField('a', { type: 'custom', field_type: 'unregistered' }),
};

describe('FieldValue resolution per field type', () => {
  it('resolves the string-valued field types', () => {
    expectTypeOf<FieldValue<typeof _f.text>>().toEqualTypeOf<string>();
    expectTypeOf<FieldValue<typeof _f.textarea>>().toEqualTypeOf<string>();
    expectTypeOf<FieldValue<typeof _f.markdown>>().toEqualTypeOf<string>();
    expectTypeOf<FieldValue<typeof _f.datetime>>().toEqualTypeOf<string>();
    expectTypeOf<FieldValue<typeof _f.option>>().toEqualTypeOf<string>();
    // Stored as a string, not a JSON number — see `FieldTypeValueMap`.
    expectTypeOf<FieldValue<typeof _f.number>>().toEqualTypeOf<string>();
  });

  it('resolves the remaining scalar and structured field types', () => {
    expectTypeOf<FieldValue<typeof _f.boolean>>().toEqualTypeOf<boolean>();
    expectTypeOf<FieldValue<typeof _f.options>>().toEqualTypeOf<string[]>();
    expectTypeOf<FieldValue<typeof _f.richtext>>().toExtend<RichtextFieldValue>();
    expectTypeOf<FieldValue<typeof _f.asset>>().toExtend<AssetFieldValue>();
    expectTypeOf<FieldValue<typeof _f.multiasset>>().toExtend<AssetFieldValue[]>();
    expectTypeOf<FieldValue<typeof _f.multilink>>().toExtend<MultilinkFieldValue>();
    expectTypeOf<FieldValue<typeof _f.table>>().toExtend<TableFieldValue>();
    expectTypeOf<FieldValue<typeof _f.custom>>().toExtend<PluginFieldValue>();
  });

  it('leaves `bloks` loose when no block registry is threaded through', () => {
    expectTypeOf<FieldValue<typeof _f.bloks>>().toEqualTypeOf<BlockContentBase[]>();
  });

  it('resolves the layout-only field types to `never`', () => {
    // `section` and `tab` group other fields in the editor and carry no content
    // value, so they must never appear in a content object.
    expectTypeOf<FieldValue<typeof _f.section>>().toEqualTypeOf<never>();
    expectTypeOf<FieldValue<typeof _f.tab>>().toEqualTypeOf<never>();
  });
});

describe('FieldValueInput resolution per field type', () => {
  it('matches the read type for every non-blok field type', () => {
    expectTypeOf<FieldValueInput<typeof _f.text>>().toEqualTypeOf<string>();
    expectTypeOf<FieldValueInput<typeof _f.textarea>>().toEqualTypeOf<string>();
    expectTypeOf<FieldValueInput<typeof _f.markdown>>().toEqualTypeOf<string>();
    expectTypeOf<FieldValueInput<typeof _f.datetime>>().toEqualTypeOf<string>();
    expectTypeOf<FieldValueInput<typeof _f.option>>().toEqualTypeOf<string>();
    expectTypeOf<FieldValueInput<typeof _f.number>>().toEqualTypeOf<string>();
    expectTypeOf<FieldValueInput<typeof _f.boolean>>().toEqualTypeOf<boolean>();
    expectTypeOf<FieldValueInput<typeof _f.options>>().toEqualTypeOf<string[]>();
    expectTypeOf<FieldValueInput<typeof _f.section>>().toEqualTypeOf<never>();
    expectTypeOf<FieldValueInput<typeof _f.tab>>().toEqualTypeOf<never>();
  });
});

describe('richtext composition with @storyblok/richtext', () => {
  it('cannot yet be handed to renderRichText', () => {
    // Known gap: `RichtextFieldValue.content` is an optional array of loose
    // records, while `SbRichTextNode.content` is a required array of
    // discriminated nodes, so a schema-typed richtext value cannot be passed to
    // `renderRichText` without a cast.
    //
    // This assertion is expected to fail. When the richtext types are made
    // compatible, the directive below becomes unused and the typecheck fails,
    // which is the signal to delete this test.
    // @ts-expect-error RichtextFieldValue is not assignable to SbRichTextInput
    expectTypeOf<RichtextFieldValue>().toExtend<SbRichTextInput>();
  });
});
