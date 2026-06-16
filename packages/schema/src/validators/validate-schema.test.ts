import { describe, expect, it } from 'vitest';
import { defineBlock } from '../helpers/define-block';
import { defineDatasource } from '../helpers/define-datasource';
import { defineField } from '../helpers/define-field';
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
    const block = { name: 'dup', fields: [{ name: 'a', type: 'text' }, { name: 'a', type: 'textarea' }] };
    const result = validateSchema({ blocks: [block] });
    expect(codesFor(result)).toContain('duplicate_field_name');
  });

  it('flags duplicate datasource slugs', () => {
    const dup = defineDatasource({ name: 'Colors 2', slug: 'colors' });
    const result = validateSchema({ blocks: {}, datasources: [colors, dup] });
    expect(codesFor(result)).toContain('duplicate_datasource_slug');
  });

  it('flags an allow reference to an unknown block', () => {
    const block = { name: 'page', fields: [{ name: 'body', type: 'bloks', allow: ['ghost'] }] };
    const result = validateSchema({ blocks: [block] });
    expect(result.ok).toBe(false);
    expect(codesFor(result)).toContain('unresolved_allow');
  });

  it('flags a datasource reference to an unknown datasource', () => {
    const block = { name: 'page', fields: [{ name: 'theme', type: 'option', datasource: 'missing' }] };
    const result = validateSchema({ blocks: [block] });
    expect(codesFor(result)).toContain('unresolved_datasource');
  });

  it('resolves a self-referencing (circular) allow without error', () => {
    const section = defineBlock({ name: 'section', fields: [defineField('children', { type: 'bloks', allow: ['section'] })] });
    const result = validateSchema({ blocks: { section } });
    expect(result.ok).toBe(true);
  });
});
