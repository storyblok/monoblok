import { describe, expect, it } from 'vitest';
import { defineBlock } from '../helpers/define-block';
import { defineField } from '../helpers/define-field';
import { validateStory } from './validate-story';

const teaser = defineBlock({ name: 'teaser', fields: [defineField('text', { type: 'text' })] });
const page = defineBlock({
  name: 'page',
  is_root: true,
  fields: [
    defineField('headline', { type: 'text', required: true }),
    defineField('cover', { type: 'asset' }),
    defineField('body', { type: 'bloks', allow: [teaser] }),
  ],
});
const schema = { blocks: { page, teaser } };

const codesFor = (result: { issues: { code: string }[] }) => result.issues.map(i => i.code);

describe('validateStory', () => {
  it('passes a well-formed story', () => {
    const result = validateStory({
      content: {
        component: 'page',
        headline: 'Hello',
        body: [{ component: 'teaser', text: 'hi' }],
      },
    }, schema);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('errors on an unknown component', () => {
    const result = validateStory({ content: { component: 'ghost' } }, schema);
    expect(result.ok).toBe(false);
    expect(codesFor(result)).toContain('unknown_component');
  });

  it('warns (but does not fail) on an unknown field', () => {
    const result = validateStory({
      content: { component: 'page', headline: 'Hi', extra: 'nope' },
    }, schema);
    expect(result.ok).toBe(true);
    expect(result.issues.some(i => i.code === 'unknown_field' && i.severity === 'warning')).toBe(true);
  });

  it('errors on a missing required field', () => {
    const result = validateStory({ content: { component: 'page' } }, schema);
    expect(result.ok).toBe(false);
    expect(codesFor(result)).toContain('missing_required_field');
  });

  it('errors on an invalid asset field value', () => {
    const result = validateStory({
      content: { component: 'page', headline: 'Hi', cover: 'not-an-asset' },
    }, schema);
    expect(result.ok).toBe(false);
    expect(codesFor(result)).toContain('invalid_value');
  });

  it('accepts a valid asset field value', () => {
    const result = validateStory({
      content: {
        component: 'page',
        headline: 'Hi',
        cover: { fieldtype: 'asset', id: null, alt: null, filename: '' },
      },
    }, schema);
    expect(result.ok).toBe(true);
  });

  it('recurses into nested bloks and reports unknown nested components', () => {
    const result = validateStory({
      content: {
        component: 'page',
        headline: 'Hi',
        body: [{ component: 'ghost' }],
      },
    }, schema);
    expect(result.ok).toBe(false);
    const unknown = result.issues.find(i => i.code === 'unknown_component');
    expect(unknown?.path).toEqual(['content', 'body', 0, 'component']);
  });
});
