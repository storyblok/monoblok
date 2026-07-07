import { describe, expect, it } from 'vitest';
import { storyblokColorField } from '../field-plugins/storyblok-color-field';
import { defineBlock } from '../helpers/define-block';
import { defineDatasource } from '../helpers/define-datasource';
import { defineField } from '../helpers/define-field';
import type { SchemaBlockLike } from './shapes';
import { validateSchema } from './validate-schema';

const colors = defineDatasource({ name: 'Colors', slug: 'colors' });
const teaser = defineBlock({ name: 'teaser', fields: [defineField('text', { type: 'text' })] });
const page = defineBlock({
  name: 'page',
  is_root: true,
  fields: [
    defineField('body', { type: 'bloks', allow: [teaser] }),
    defineField('theme', { type: 'option', datasource: colors }),
  ],
});

const codesFor = (result: { issues: { code: string }[] }) => result.issues.map(i => i.code);

describe('validateSchema', () => {
  it('passes a valid schema with resolvable allow and datasource refs', () => {
    const result = validateSchema({ blocks: { page, teaser }, datasources: { colors } });
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('flags duplicate block names', () => {
    const dup = defineBlock({ name: 'teaser', fields: [] });
    const result = validateSchema({ blocks: [teaser, dup] });
    expect(result.ok).toBe(false);
    expect(codesFor(result)).toContain('duplicate_block_name');
  });

  it('flags duplicate field names within a block', () => {
    // Build the block shape directly to bypass defineBlock's runtime guard.
    const block: SchemaBlockLike = { name: 'dup', fields: [{ name: 'a', type: 'text' }, { name: 'a', type: 'textarea' }] };
    const result = validateSchema({ blocks: [block] });
    expect(codesFor(result)).toContain('duplicate_field_name');
  });

  it('flags duplicate datasource slugs', () => {
    const dup = defineDatasource({ name: 'Colors 2', slug: 'colors' });
    const result = validateSchema({ blocks: {}, datasources: [colors, dup] });
    expect(codesFor(result)).toContain('duplicate_datasource_slug');
  });

  it('flags an allow reference to an unknown block', () => {
    const block = defineBlock({ name: 'page', fields: [defineField('body', { type: 'bloks', allow: ['ghost'] })] });
    const result = validateSchema({ blocks: [block] });
    expect(result.ok).toBe(false);
    expect(codesFor(result)).toContain('unresolved_allow');
  });

  it('flags a datasource reference to an unknown datasource', () => {
    const block = defineBlock({ name: 'page', fields: [defineField('theme', { type: 'option', datasource: 'missing' })] });
    const result = validateSchema({ blocks: [block] });
    expect(codesFor(result)).toContain('unresolved_datasource');
  });

  it('resolves a self-referencing (circular) allow without error', () => {
    const section = defineBlock({ name: 'section', fields: [defineField('children', { type: 'bloks', allow: ['section'] })] });
    const result = validateSchema({ blocks: { section } });
    expect(result.ok).toBe(true);
  });

  it('flags a field that is missing a string name (silently dropped by the wire mapper)', () => {
    // Bypass defineField's normalization to model malformed authored input.
    const block = { name: 'broken', fields: [{ type: 'text' }] } as unknown as SchemaBlockLike;
    const result = validateSchema({ blocks: [block] });
    expect(result.ok).toBe(false);
    expect(codesFor(result)).toContain('missing_field_name');
  });

  it('flags a field that is not an object', () => {
    const block = { name: 'broken', fields: ['nope'] } as unknown as SchemaBlockLike;
    const result = validateSchema({ blocks: [block] });
    expect(result.ok).toBe(false);
    expect(codesFor(result)).toContain('invalid_field');
  });

  it('flags a custom field referencing an unregistered field plugin', () => {
    const block = defineBlock({ name: 'hero', fields: [defineField('bg', { type: 'custom', field_type: 'storyblok-colorpicker' })] });
    const result = validateSchema({ blocks: [block] });
    expect(result.ok).toBe(false);
    expect(codesFor(result)).toContain('unresolved_field_plugin');
  });

  it('resolves a custom field to a registered field plugin', () => {
    const block = defineBlock({ name: 'hero', fields: [defineField('bg', { type: 'custom', field_type: 'storyblok-colorpicker' })] });
    const result = validateSchema({ blocks: [block], fieldPlugins: { storyblokColorField } });
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });
});
