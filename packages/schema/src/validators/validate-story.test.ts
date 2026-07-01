import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineBlock } from '../helpers/define-block';
import { defineField } from '../helpers/define-field';
import { defineFieldPlugin } from '../helpers/define-field-plugin';
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

  describe('custom field plugins', () => {
    const colorPlugin = defineFieldPlugin({
      fieldType: 'storyblok-colorpicker',
      value: z.object({ color: z.string() }),
    });
    const pageWithPlugin = defineBlock({
      name: 'page',
      is_root: true,
      fields: [
        defineField('headline', { type: 'text', required: true }),
        defineField('accent', { type: 'custom', field_type: 'storyblok-colorpicker' }),
      ],
    });
    const pluginSchema = { blocks: { page: pageWithPlugin }, fieldPlugins: { colorPlugin } };

    it('accepts a registered plugin value that matches its validator', () => {
      const result = validateStory({
        content: {
          component: 'page',
          headline: 'Hi',
          accent: { plugin: 'storyblok-colorpicker', _uid: 'abc-123', color: '#fff' },
        },
      }, pluginSchema);
      expect(result.ok).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it('errors on a registered plugin value with the wrong inner type', () => {
      const result = validateStory({
        content: {
          component: 'page',
          headline: 'Hi',
          accent: { plugin: 'storyblok-colorpicker', _uid: 'abc-123', color: 12345 },
        },
      }, pluginSchema);
      expect(result.ok).toBe(false);
      const colorIssue = result.issues.find(i => i.code === 'invalid_value');
      expect(colorIssue?.path).toEqual(['content', 'accent', 'color']);
    });

    it('checks only the envelope for an unregistered field_type', () => {
      const pageWithUnknownPlugin = defineBlock({
        name: 'page',
        is_root: true,
        fields: [
          defineField('headline', { type: 'text', required: true }),
          defineField('accent', { type: 'custom', field_type: 'unregistered-plugin' }),
        ],
      });
      const result = validateStory({
        content: {
          component: 'page',
          headline: 'Hi',
          accent: { plugin: 'unregistered-plugin', _uid: 'abc-123', color: 12345 },
        },
      }, { blocks: { page: pageWithUnknownPlugin }, fieldPlugins: { colorPlugin } });
      expect(result.ok).toBe(true);
    });

    it('errors when the envelope plugin key is missing', () => {
      const result = validateStory({
        content: {
          component: 'page',
          headline: 'Hi',
          accent: { color: '#fff' },
        },
      }, pluginSchema);
      expect(result.ok).toBe(false);
      expect(codesFor(result)).toContain('invalid_value');
    });

    it('accepts a non-UUID _uid string (envelope relaxation)', () => {
      const result = validateStory({
        content: {
          component: 'page',
          headline: 'Hi',
          accent: { plugin: 'storyblok-colorpicker', _uid: 'not-a-uuid', color: '#fff' },
        },
      }, pluginSchema);
      expect(result.ok).toBe(true);
      expect(result.issues).toEqual([]);
    });
  });
});

const asset = () => ({ fieldtype: 'asset' as const, id: null, alt: null, filename: '' });

const constrained = defineBlock({
  name: 'constrained',
  is_root: true,
  fields: [
    defineField('rating', { type: 'number', min_value: 1, max_value: 5 }),
    defineField('title', { type: 'text', max_length: 5, minlength: 2 }),
    defineField('tags', { type: 'options', min_options: '1', max_options: '2' }),
    defineField('gallery', { type: 'multiasset', minimum_entries: 1, maximum_entries: 2 }),
    defineField('items', { type: 'bloks', allow: [teaser], minimum: 1, maximum: 2 }),
  ],
});
const cSchema = { blocks: { constrained, teaser } };

const validContent = {
  component: 'constrained',
  rating: 3,
  title: 'hey',
  tags: ['a'],
  gallery: [asset()],
  items: [{ component: 'teaser', text: 'hi' }],
};

const validate = (overrides: Record<string, unknown>) =>
  validateStory({ content: { ...validContent, ...overrides } }, cSchema);

describe('validateStory — constraints', () => {
  it('passes when every value is within its constraints', () => {
    expect(validate({}).ok).toBe(true);
  });

  it('errors when a number is below min_value or above max_value', () => {
    expect(validate({ rating: 0 }).issues.some(i => i.code === 'constraint_violation')).toBe(true);
    expect(validate({ rating: 6 }).issues.some(i => i.code === 'constraint_violation')).toBe(true);
    expect(validate({ rating: 5 }).ok).toBe(true);
  });

  it('errors when a number has more decimal places than decimals allows', () => {
    const block = defineBlock({
      name: 'priced',
      is_root: true,
      fields: [defineField('price', { type: 'number', decimals: 2 })],
    });
    const s = { blocks: { priced: block } };
    expect(validateStory({ content: { component: 'priced', price: 9.999 } }, s).issues.some(i => i.code === 'constraint_violation')).toBe(true);
    expect(validateStory({ content: { component: 'priced', price: 9.99 } }, s).ok).toBe(true);
    expect(validateStory({ content: { component: 'priced', price: 10 } }, s).ok).toBe(true);
  });

  it('errors when a number is not a multiple of steps', () => {
    const block = defineBlock({
      name: 'stepped',
      is_root: true,
      fields: [defineField('amount', { type: 'number', steps: 0.5, min_value: 1 })],
    });
    const s = { blocks: { stepped: block } };
    expect(validateStory({ content: { component: 'stepped', amount: 2.3 } }, s).issues.some(i => i.code === 'constraint_violation')).toBe(true);
    // 1, 1.5, 2 are on-step (offset from min_value 1); float artifacts tolerated.
    expect(validateStory({ content: { component: 'stepped', amount: 2.5 } }, s).ok).toBe(true);
    expect(validateStory({ content: { component: 'stepped', amount: 2 } }, s).ok).toBe(true);
  });

  it('errors when text exceeds max_length or is below minlength', () => {
    expect(validate({ title: 'toolong' }).issues.some(i => i.code === 'constraint_violation')).toBe(true);
    expect(validate({ title: 'a' }).issues.some(i => i.code === 'constraint_violation')).toBe(true);
  });

  it('errors when options count is outside min_options/max_options', () => {
    expect(validate({ tags: [] }).issues.some(i => i.code === 'constraint_violation')).toBe(true);
    expect(validate({ tags: ['a', 'b', 'c'] }).issues.some(i => i.code === 'constraint_violation')).toBe(true);
  });

  it('errors when multiasset count is outside minimum_entries/maximum_entries', () => {
    expect(validate({ gallery: [] }).issues.some(i => i.code === 'constraint_violation')).toBe(true);
    expect(validate({ gallery: [asset(), asset(), asset()] }).issues.some(i => i.code === 'constraint_violation')).toBe(true);
  });

  it('errors when bloks count is outside minimum/maximum', () => {
    expect(validate({ items: [] }).issues.some(i => i.code === 'constraint_violation')).toBe(true);
    expect(validate({
      items: [
        { component: 'teaser', text: '1' },
        { component: 'teaser', text: '2' },
        { component: 'teaser', text: '3' },
      ],
    }).issues.some(i => i.code === 'constraint_violation')).toBe(true);
  });

  it('errors when a blok component is not in the field allow list', () => {
    const result = validate({ items: [{ component: 'constrained', rating: 3 }] });
    const disallowed = result.issues.find(i => i.code === 'disallowed_component');
    expect(disallowed).toBeDefined();
    expect(disallowed?.path).toEqual(['content', 'items', 0, 'component']);
  });
});
