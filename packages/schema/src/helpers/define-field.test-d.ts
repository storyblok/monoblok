import { describe, expectTypeOf, it } from 'vitest';
import type { FieldValue } from '../generated/types/field';
import { defineBlock } from './define-block';
import { defineField } from './define-field';
import { defineFolder } from './define-folder';

describe('defineField type inference', () => {
  it('should narrow type based on field type discriminant', () => {
    const f = defineField('title', { type: 'text', max_length: 100 });
    expectTypeOf(f.type).toEqualTypeOf<'text'>();
    expectTypeOf(f.name).toEqualTypeOf<'title'>();
    // const generic preserves the literal value 100, not the widened number | undefined
    expectTypeOf(f.max_length).toEqualTypeOf<100>();
  });

  it('should not include config keys from other field types', () => {
    const f = defineField('title', { type: 'text', max_length: 100 });
    // @ts-expect-error 'options' is not a valid key for 'text' fields
    void f.options;
  });

  it('should narrow option field type correctly', () => {
    const f = defineField('toggle', {
      type: 'option',
      options: [{ name: 'Yes', value: 'yes' }],
    });
    expectTypeOf(f.type).toEqualTypeOf<'option'>();
  });

  it('should narrow number field type correctly', () => {
    const f = defineField('count', { type: 'number', min_value: 0, max_value: 100 });
    expectTypeOf(f.type).toEqualTypeOf<'number'>();
    // const generic preserves the literal value 0, not the widened number | undefined
    expectTypeOf(f.min_value).toEqualTypeOf<0>();
  });

  it('should normalize a string `allow` list to a literal tuple on bloks fields', () => {
    const f = defineField('body', { type: 'bloks', allow: ['teaser', 'hero'] });
    expectTypeOf(f.type).toEqualTypeOf<'bloks'>();
    type Allow = (typeof f)['allow'];
    expectTypeOf<Allow[number]>().toEqualTypeOf<'teaser' | 'hero'>();
  });

  it('should normalize block-object refs in `allow` to their name literals', () => {
    const heroBlock = { name: 'hero' as const };
    const teaserBlock = { name: 'teaser' as const };
    const _f = defineField('body', { type: 'bloks', allow: [heroBlock, teaserBlock, 'intro'] });
    type Allow = (typeof _f)['allow'];
    expectTypeOf<Allow[number]>().toEqualTypeOf<'hero' | 'teaser' | 'intro'>();
  });

  it('should normalize a `datasource` ref to its slug literal', () => {
    const colors = { slug: 'colors' as const };
    const _f = defineField('theme', { type: 'option', source: 'internal', datasource: colors });
    expectTypeOf<(typeof _f)['datasource']>().toEqualTypeOf<'colors'>();
  });

  it('should normalize folder allow entries to { folder: path } literals', () => {
    const heros = defineFolder({ name: 'Heros' });
    const field = defineField('body', { type: 'bloks', allow: [heros] });
    expectTypeOf(field.allow).toEqualTypeOf<readonly [{ folder: 'Heros' }]>();
  });

  it('should narrow bloks content by folder allow entries, including nested folders', () => {
    const layout = defineFolder({ name: 'Layout' });
    const heros = defineFolder({ name: 'Heros', parent: layout });
    const _heroBlock = defineBlock({ name: 'hero', folder: heros, fields: [] });
    const _teaserBlock = defineBlock({ name: 'teaser', fields: [] });
    const _pageBlock = defineBlock({
      name: 'page',
      is_root: true,
      fields: [defineField('body', { type: 'bloks', allow: [layout] })],
    });
    type Body = FieldValue<(typeof _pageBlock)['fields'][0], typeof _heroBlock | typeof _teaserBlock>;
    expectTypeOf<Body[number]['component']>().toEqualTypeOf<'hero'>();
  });

  it('should narrow by folder allow entries case-insensitively (ref casing vs string shorthand casing)', () => {
    const blog = defineFolder({ name: 'Blog' });
    // Block declares its folder as a lower-cased string shorthand; the allow ref
    // resolves to `'Blog'`. Same folder at push/editor time, so narrowing keeps it.
    const _postBlock = defineBlock({ name: 'post', folder: 'blog', fields: [] });
    const _teaserBlock = defineBlock({ name: 'teaser', fields: [] });
    const _pageBlock = defineBlock({
      name: 'page',
      is_root: true,
      fields: [defineField('body', { type: 'bloks', allow: [blog] })],
    });
    type Body = FieldValue<(typeof _pageBlock)['fields'][0], typeof _postBlock | typeof _teaserBlock>;
    expectTypeOf<Body[number]['component']>().toEqualTypeOf<'post'>();
  });

  it('should type `default_value` per field type', () => {
    const bool = defineField('default_open', { type: 'boolean', default_value: false });
    expectTypeOf(bool.default_value).toEqualTypeOf<false>();

    const text = defineField('title', { type: 'text', default_value: 'Hello' });
    expectTypeOf(text.default_value).toEqualTypeOf<'Hello'>();

    // Numbers are stored as strings, matching what the editor writes.
    const num = defineField('count', { type: 'number', default_value: '42' });
    expectTypeOf(num.default_value).toEqualTypeOf<'42'>();

    // Bloks and options accept either the JSON-encoded value or the array.
    const bloks = defineField('body', { type: 'bloks', default_value: [{ component: 'hero' }] });
    expectTypeOf(bloks.default_value[0].component).toEqualTypeOf<'hero'>();
    const options = defineField('tags', { type: 'options', default_value: 'a b' });
    expectTypeOf(options.default_value).toEqualTypeOf<'a b'>();
  });

  it('should reject `default_value` values that do not match the field type', () => {
    // @ts-expect-error boolean fields take a boolean, not a string
    void defineField('default_open', { type: 'boolean', default_value: 'false' });
    // @ts-expect-error text fields take a string, not a boolean
    void defineField('title', { type: 'text', default_value: false });
  });

  it('should normalize a `deny` list to a literal tuple of block names', () => {
    const heroBlock = defineBlock({ name: 'hero', fields: [] });
    const f = defineField('body', { type: 'bloks', deny: [heroBlock, 'banner'] });
    expectTypeOf(f.deny).toEqualTypeOf<readonly ['hero', 'banner']>();
  });

  it('should narrow bloks content by `deny` alone', () => {
    const _heroBlock = defineBlock({ name: 'hero', is_nestable: true, fields: [] });
    const _bannerBlock = defineBlock({ name: 'banner', is_nestable: true, fields: [] });
    const _pageBlock = defineBlock({
      name: 'page',
      is_root: true,
      fields: [defineField('body', { type: 'bloks', deny: ['banner'] })],
    });
    type Body = FieldValue<(typeof _pageBlock)['fields'][0], typeof _heroBlock | typeof _bannerBlock>;
    expectTypeOf<Body[number]['component']>().toEqualTypeOf<'hero'>();
  });

  it('should compose `allow` and `deny` on the same bloks field', () => {
    const _heroBlock = defineBlock({ name: 'hero', is_nestable: true, fields: [] });
    const _teaserBlock = defineBlock({ name: 'teaser', is_nestable: true, fields: [] });
    const _bannerBlock = defineBlock({ name: 'banner', is_nestable: true, fields: [] });
    const _pageBlock = defineBlock({
      name: 'page',
      is_root: true,
      fields: [defineField('body', {
        type: 'bloks',
        allow: ['hero', 'teaser', 'banner'],
        deny: ['banner'],
      })],
    });
    type Body = FieldValue<
      (typeof _pageBlock)['fields'][0],
      typeof _heroBlock | typeof _teaserBlock | typeof _bannerBlock
    >;
    expectTypeOf<Body[number]['component']>().toEqualTypeOf<'hero' | 'teaser'>();
  });

  it('should treat a `deny` entry naming an unknown block as inert', () => {
    const _heroBlock = defineBlock({ name: 'hero', is_nestable: true, fields: [] });
    const _teaserBlock = defineBlock({ name: 'teaser', is_nestable: true, fields: [] });
    const _pageBlock = defineBlock({
      name: 'page',
      is_root: true,
      fields: [defineField('body', { type: 'bloks', deny: ['ghost'] })],
    });
    type Body = FieldValue<(typeof _pageBlock)['fields'][0], typeof _heroBlock | typeof _teaserBlock>;
    expectTypeOf<Body[number]['component']>().toEqualTypeOf<'hero' | 'teaser'>();
  });

  it('should not include `allow` when not provided on a bloks field', () => {
    const f = defineField('body', { type: 'bloks' });
    expectTypeOf(f.type).toEqualTypeOf<'bloks'>();
    // @ts-expect-error property does not exist when not supplied
    void f.allow;
  });
});
