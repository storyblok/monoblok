import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import { defineBlock } from '../helpers/define-block';
import { defineField } from '../helpers/define-field';
import { defineFieldPlugin } from '../helpers/define-field-plugin';
import { defineFolder } from '../helpers/define-folder';
import { storyblokColorField } from '../field-plugins/storyblok-color-field';
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

  it('errors on a required field left as an empty string', () => {
    // The backend's required check is `field_value.blank?`, and `''.blank?` is
    // true, so an empty string is unset rather than a value.
    const result = validateStory({ content: { component: 'page', headline: '' } }, schema);
    expect(result.ok).toBe(false);
    expect(codesFor(result)).toContain('missing_required_field');
  });

  it('errors on a required number left unset', () => {
    // A number field stores `''` when unset — the one case where the wire form
    // of "no value" is also a legal value for the type.
    const blocks = {
      page: defineBlock({
        name: 'page',
        is_root: true,
        fields: [defineField('count', { type: 'number', required: true })],
      }),
    };
    const result = validateStory({ content: { component: 'page', count: '' } }, { blocks });
    expect(result.ok).toBe(false);
    expect(codesFor(result)).toContain('missing_required_field');
  });

  it('accepts an optional number left unset', () => {
    const blocks = {
      page: defineBlock({
        name: 'page',
        is_root: true,
        fields: [defineField('count', { type: 'number' })],
      }),
    };
    const result = validateStory({ content: { component: 'page', count: '' } }, { blocks });
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
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

    it('reports the `color` sub-path for the shipped storyblokColorField plugin', () => {
      const result = validateStory({
        content: {
          component: 'page',
          headline: 'Hi',
          accent: { plugin: 'storyblok-colorpicker', _uid: 'abc-123', color: 123 },
        },
      }, { blocks: { page: pageWithPlugin }, fieldPlugins: { storyblokColorField } });
      expect(result.ok).toBe(false);
      const colorIssue = result.issues.find(i => i.code === 'invalid_value');
      expect(colorIssue?.path).toEqual(['content', 'accent', 'color']);
    });

    it('errors instead of silently passing when a plugin ships an async validator', () => {
      const asyncValue: StandardSchemaV1<{ color: string }> = {
        '~standard': {
          version: 1,
          vendor: 'test',
          validate: () => Promise.resolve({ value: { color: 'x' } }),
        },
      };
      const asyncPlugin = defineFieldPlugin({ fieldType: 'storyblok-colorpicker', value: asyncValue });
      const result = validateStory({
        content: {
          component: 'page',
          headline: 'Hi',
          accent: { plugin: 'storyblok-colorpicker', _uid: 'abc-123', color: 'x' },
        },
      }, { blocks: { page: pageWithPlugin }, fieldPlugins: { asyncPlugin } });
      expect(result.ok).toBe(false);
      expect(codesFor(result)).toContain('async_validator_unsupported');
    });
  });
});

const linkedPage = defineBlock({
  name: 'linked-page',
  is_root: true,
  fields: [defineField('cta', { type: 'multilink' })],
});
const linkedSchema = { blocks: { linkedPage } };
const multilinkBase = {
  fieldtype: 'multilink',
  id: '',
  url: '',
  cached_url: '',
};
const validateMultilink = (cta: unknown) => validateStory({
  content: { component: 'linked-page', cta },
}, linkedSchema);

describe('validateStory — multilink values', () => {
  it('accepts every raw Storyfront multilink variant', () => {
    const variants = [
      { ...multilinkBase, linktype: 'story', anchor: 'features', rel: 'bookmark' },
      { ...multilinkBase, linktype: 'url', url: 'https://example.com', title: 'Example' },
      { ...multilinkBase, linktype: 'email', email: 'hello@example.com' },
      { ...multilinkBase, linktype: 'asset', id: 'asset-id' },
    ];

    for (const variant of variants) {
      expect(validateMultilink(variant).ok).toBe(true);
    }
  });

  it.each([
    ['nullable target', { ...multilinkBase, linktype: 'asset', target: null }],
    ['nullable story anchor', { ...multilinkBase, linktype: 'story', anchor: null }],
    ['non-string URL attribute', { ...multilinkBase, linktype: 'url', rel: 42 }],
    ['non-string custom story attribute', { ...multilinkBase, linktype: 'story', analytics: 42 }],
  ])('rejects %s', (_label, value) => {
    const result = validateMultilink(value);

    expect(result.ok).toBe(false);
    expect(codesFor(result)).toContain('invalid_value');
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
  rating: '3',
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
    expect(validate({ rating: '0' }).issues.some(i => i.code === 'constraint_violation')).toBe(true);
    expect(validate({ rating: '6' }).issues.some(i => i.code === 'constraint_violation')).toBe(true);
    expect(validate({ rating: '5' }).ok).toBe(true);
  });

  it('errors when a number has more decimal places than decimals allows', () => {
    const block = defineBlock({
      name: 'priced',
      is_root: true,
      fields: [defineField('price', { type: 'number', decimals: 2 })],
    });
    const s = { blocks: { priced: block } };
    expect(validateStory({ content: { component: 'priced', price: '9.999' } }, s).issues.some(i => i.code === 'constraint_violation')).toBe(true);
    expect(validateStory({ content: { component: 'priced', price: '9.99' } }, s).ok).toBe(true);
    expect(validateStory({ content: { component: 'priced', price: '10' } }, s).ok).toBe(true);
  });

  it('errors when a number is not a multiple of steps', () => {
    const block = defineBlock({
      name: 'stepped',
      is_root: true,
      fields: [defineField('amount', { type: 'number', steps: 0.5, min_value: 1 })],
    });
    const s = { blocks: { stepped: block } };
    expect(validateStory({ content: { component: 'stepped', amount: '2.3' } }, s).issues.some(i => i.code === 'constraint_violation')).toBe(true);
    // 1, 1.5, 2 are on-step (offset from min_value 1); float artifacts tolerated.
    expect(validateStory({ content: { component: 'stepped', amount: '2.5' } }, s).ok).toBe(true);
    expect(validateStory({ content: { component: 'stepped', amount: '2' } }, s).ok).toBe(true);
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
    const result = validate({ items: [{ component: 'constrained', rating: '3' }] });
    const disallowed = result.issues.find(i => i.code === 'disallowed_component');
    expect(disallowed).toBeDefined();
    expect(disallowed?.path).toEqual(['content', 'items', 0, 'component']);
  });

  // A component missing from the schema is one mistake, not two: reporting both
  // `unknown_component` and `disallowed_component` double-counted it and buried
  // the real cause.
  it('reports only unknown_component for a component the schema does not define', () => {
    const result = validate({ items: [{ component: 'nope' }] });
    const codes = result.issues.map(issue => issue.code);
    expect(codes).toContain('unknown_component');
    expect(codes).not.toContain('disallowed_component');
  });
});

describe('validateStory — number wire format', () => {
  const priced = defineBlock({
    name: 'priced',
    is_root: true,
    fields: [defineField('price', { type: 'number', decimals: 2 })],
  });
  const s = { blocks: { priced } };
  const check = (price: unknown) => validateStory({ content: { component: 'priced', price } }, s);

  // The Management API stores number fields as strings and rejects JSON numbers
  // with "must be a string with numbers and allow '-' and '.'".
  it('accepts the numeric string the API requires', () => {
    expect(check('7').ok).toBe(true);
    expect(check('-7').ok).toBe(true);
    expect(check('0.5').ok).toBe(true);
    expect(check('.5').ok).toBe(true);
  });

  it('rejects a JSON number, which the API refuses to store', () => {
    expect(check(7).issues.some(i => i.code === 'invalid_value')).toBe(true);
  });

  // `Expected string, received number.` reads like a validator bug on a field
  // that looks numeric; the message has to name the wire format.
  it('explains that the wire form of a number field is a string', () => {
    expect(check(7).issues[0].message).toBe(
      'Expected a numeric string (number fields are stored as strings), received number.',
    );
  });

  it('rejects strings that are not numeric', () => {
    expect(check('abc').ok).toBe(false);
    expect(check('12a3').ok).toBe(false);
    expect(check('12.3.4').ok).toBe(false);
  });

  it('accepts an empty string, which is how an unset number field is stored', () => {
    expect(check('').ok).toBe(true);
  });

  it('counts decimal places off the source string, preserving trailing zeros', () => {
    expect(check('9.99').ok).toBe(true);
    expect(check('9.990').issues.some(i => i.code === 'constraint_violation')).toBe(true);
  });
});

describe('validateStory — folder allow entries', () => {
  const layout = defineFolder({ name: 'Layout' });
  const heros = defineFolder({ name: 'Heros', parent: layout });
  const hero = defineBlock({ name: 'hero', folder: heros, fields: [defineField('title', { type: 'text' })] });
  const teaserBlock = defineBlock({ name: 'teaser', fields: [defineField('text', { type: 'text' })] });
  const pageWithFolderAllow = defineBlock({
    name: 'page',
    is_root: true,
    fields: [defineField('body', { type: 'bloks', allow: [layout] })],
  });
  const folderSchema = { blocks: { page: pageWithFolderAllow, hero, teaser: teaserBlock } };

  it('allows components whose block folder is inside an allowed folder', () => {
    const result = validateStory({
      content: {
        component: 'page',
        body: [{ component: 'hero', title: 'Hi' }],
      },
    }, folderSchema);
    expect(result.issues.find(i => i.code === 'disallowed_component')).toBeUndefined();
    expect(result.ok).toBe(true);
  });

  it('rejects components outside the allowed folder', () => {
    const result = validateStory({
      content: {
        component: 'page',
        body: [{ component: 'teaser', text: 'hi' }],
      },
    }, folderSchema);
    const disallowed = result.issues.find(i => i.code === 'disallowed_component');
    expect(disallowed).toBeDefined();
    expect(disallowed?.message).toBe(
      'Component "teaser" is not allowed in field "body"; allowed: folder:Layout.',
    );
    expect(disallowed?.message).not.toContain('[object Object]');
  });

  it('matches folder paths in slug space, so casing/separator drift between a ref and a string shorthand still allows the block', () => {
    // `driftHero` writes its folder as a lower-cased, dash-separated string; the
    // allow ref resolves to the display path `My Layout/Heros`. The CLI/editor
    // group both under the same component group, so the validator must too.
    const myLayout = defineFolder({ name: 'My Layout' });
    const myHeros = defineFolder({ name: 'Heros', parent: myLayout });
    const driftHero = defineBlock({
      name: 'drift_hero',
      folder: 'my-layout/heros',
      fields: [defineField('title', { type: 'text' })],
    });
    const pageDrift = defineBlock({
      name: 'page',
      is_root: true,
      fields: [defineField('body', { type: 'bloks', allow: [myHeros] })],
    });
    const result = validateStory({
      content: {
        component: 'page',
        body: [{ component: 'drift_hero', title: 'Hi' }],
      },
    }, { blocks: { page: pageDrift, drift_hero: driftHero } });
    expect(result.issues.find(i => i.code === 'disallowed_component')).toBeUndefined();
    expect(result.ok).toBe(true);
  });
});

describe('validateStory — richtext allow entries', () => {
  // `mapFieldToWire` pushes folder/name `allow` on a richtext field as a real
  // editor/API restriction, so `validateStory` must enforce it for bloks
  // embedded in richtext, not only top-level `bloks` fields.
  const layout = defineFolder({ name: 'Layout' });
  const hero = defineBlock({ name: 'hero', folder: layout, fields: [defineField('title', { type: 'text' })] });
  const teaserBlock = defineBlock({ name: 'teaser', fields: [defineField('text', { type: 'text' })] });
  const page = defineBlock({
    name: 'page',
    is_root: true,
    fields: [defineField('body', { type: 'richtext', allow: [layout] })],
  });
  const schema = { blocks: { page, hero, teaser: teaserBlock } };

  /** Wraps embedded bloks in a minimal richtext `doc` with one `blok` node. */
  function richtextWith(bloks: unknown[]): unknown {
    return { type: 'doc', content: [{ type: 'blok', attrs: { id: 'x', body: bloks } }] };
  }

  it('allows an embedded blok whose folder is inside an allowed folder', () => {
    const result = validateStory({
      content: { component: 'page', body: richtextWith([{ _uid: 'uid-1', component: 'hero', title: 'Hi' }]) },
    }, schema);
    expect(result.issues.find(i => i.code === 'disallowed_component')).toBeUndefined();
    expect(result.ok).toBe(true);
  });

  it('rejects an embedded blok outside the allowed folder', () => {
    const result = validateStory({
      content: { component: 'page', body: richtextWith([{ _uid: 'uid-1', component: 'teaser', text: 'hi' }]) },
    }, schema);
    const disallowed = result.issues.find(i => i.code === 'disallowed_component');
    expect(disallowed).toBeDefined();
    expect(disallowed?.path).toEqual(['content', 'body', 'content', 0, 'attrs', 'body', 0, 'component']);
    expect(disallowed?.message).toBe(
      'Component "teaser" is not allowed in field "body"; allowed: folder:Layout.',
    );
  });
});

// Removing or renaming an option in the schema is exactly the change that
// orphans existing content, so a stored value outside the declared list must be
// reported rather than passing as "some string".
describe('validateStory — declared options', () => {
  const article = defineBlock({
    name: 'article',
    is_root: true,
    fields: [
      defineField('tier', { type: 'option', options: [{ name: 'Gold', value: 'gold' }, { name: 'Silver', value: 'silver' }] }),
      defineField('tags', { type: 'options', options: [{ name: 'A', value: 'a' }, { name: 'B', value: 'b' }] }),
    ],
  });
  const s = { blocks: { article } };
  const check = (content: Record<string, unknown>) =>
    validateStory({ content: { component: 'article', ...content } }, s);

  it('accepts a declared option value', () => {
    expect(check({ tier: 'gold', tags: ['a', 'b'] }).ok).toBe(true);
  });

  it('rejects an option value that is not declared', () => {
    const issue = check({ tier: 'bronze' }).issues.find(i => i.code === 'unknown_option');
    expect(issue?.path).toEqual(['content', 'tier']);
    expect(issue?.message).toBe('Value "bronze" is not one of the options declared for field "tier": "gold", "silver".');
  });

  it('rejects an undeclared entry of a multi-option value and points at its index', () => {
    const issue = check({ tags: ['a', 'zz'] }).issues.find(i => i.code === 'unknown_option');
    expect(issue?.path).toEqual(['content', 'tags', 1]);
  });

  it('accepts an empty string, which is how an unset option field is stored', () => {
    expect(check({ tier: '' }).ok).toBe(true);
  });

  it('skips fields whose options are resolved in the space', () => {
    // A datasource-backed field carries no entries in the schema (entries are
    // content), so its accepted values are not knowable offline.
    const themed = defineBlock({
      name: 'themed',
      is_root: true,
      fields: [defineField('theme', { type: 'option', source: 'internal', datasource: 'colors' })],
    });
    const result = validateStory({ content: { component: 'themed', theme: 'anything' } }, { blocks: { themed } });
    expect(result.ok).toBe(true);
  });

  it('skips a field that declares no options', () => {
    const free = defineBlock({
      name: 'free',
      is_root: true,
      fields: [defineField('tier', { type: 'option' })],
    });
    expect(validateStory({ content: { component: 'free', tier: 'whatever' } }, { blocks: { free } }).ok).toBe(true);
  });
});

// Zod reports a bare `Invalid input` for a failed union, which told the user
// nothing about what a valid multilink/asset/richtext value looks like.
describe('validateStory — value messages', () => {
  const linked = defineBlock({
    name: 'linked',
    is_root: true,
    fields: [
      defineField('link', { type: 'multilink' }),
      defineField('cover', { type: 'asset' }),
      defineField('body', { type: 'richtext' }),
    ],
  });
  const s = { blocks: { linked } };
  const messageFor = (content: Record<string, unknown>) =>
    validateStory({ content: { component: 'linked', ...content } }, s).issues[0]?.message;

  it('describes the accepted shape when a multilink union fails', () => {
    expect(messageFor({ link: { linktype: 'nonsense' } })).toBe(
      'Expected a link object: { fieldtype: "multilink", linktype: "story" | "url" | "email" | "asset", id, url, cached_url }.',
    );
  });

  it('describes the accepted shape when an asset value is not an object', () => {
    expect(messageFor({ cover: 'https://a.storyblok.com/f/1/x.png' })).toBe(
      'Expected an asset object: { fieldtype: "asset", id, alt, filename }.',
    );
  });

  it('describes the accepted shape when a richtext value is not a document', () => {
    expect(messageFor({ body: 'plain text' })).toBe(
      'Expected a richtext document: { type: "doc", content: [...] }.',
    );
  });

  it('keeps the validator message for a failure inside the value, which names the key', () => {
    const message = messageFor({ cover: { fieldtype: 'asset', id: 1, alt: null } });
    expect(message).toContain('expected string');
    expect(message?.endsWith('.')).toBe(true);
  });
});

// Field-level translations are stored as `<field>__i18n__<locale>` siblings of
// the default value. Treating them as separate keys made every translated field
// warn as unknown *and* left its value unchecked, so a wrong type in any locale
// but the default passed silently.
describe('validateStory — field-level translations', () => {
  const page = defineBlock({
    name: 'page',
    is_root: true,
    fields: [
      defineField('headline', { type: 'text', required: true }),
      defineField('cover', { type: 'asset' }),
      defineField('body', { type: 'bloks', allow: [teaser] }),
    ],
  });
  const s = { blocks: { page, teaser } };

  it('accepts a translated value without reporting it as an unknown field', () => {
    const result = validateStory({
      content: { component: 'page', headline: 'Hello', headline__i18n__de: 'Hallo' },
    }, s);
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('validates a translated value against its field definition', () => {
    const result = validateStory({
      content: { component: 'page', headline: 'Hello', headline__i18n__de: 12345 },
    }, s);
    expect(result.ok).toBe(false);
    const issue = result.issues.find(i => i.code === 'invalid_value');
    expect(issue?.path).toEqual(['content', 'headline__i18n__de']);
    expect(issue?.message).toBe('Expected string, received number.');
  });

  it('recurses into bloks nested under a translated field', () => {
    const result = validateStory({
      content: {
        component: 'page',
        headline: 'Hello',
        body__i18n__de: [{ _uid: 'uid-1', component: 'ghost' }],
      },
    }, s);
    expect(codesFor(result)).toContain('unknown_component');
    expect(result.issues[0]?.path).toEqual(['content', 'body__i18n__de', 0, 'component']);
  });

  it('reports every locale of a field independently', () => {
    const result = validateStory({
      content: {
        component: 'page',
        headline: 'Hello',
        headline__i18n__de: 1,
        headline__i18n__fr: 2,
      },
    }, s);
    expect(result.issues.map(i => i.path)).toEqual([
      ['content', 'headline__i18n__de'],
      ['content', 'headline__i18n__fr'],
    ]);
  });

  it('keeps required scoped to the default value, so an untranslated locale is not a missing value', () => {
    // Only `de` is translated. `fr` being absent is normal content, not drift.
    const result = validateStory({
      content: { component: 'page', headline: 'Hello', headline__i18n__de: 'Hallo' },
    }, s);
    expect(codesFor(result)).not.toContain('missing_required_field');
  });

  it('still reports a required field left unset even when a locale carries a value', () => {
    const result = validateStory({
      content: { component: 'page', headline: '', headline__i18n__de: 'Hallo' },
    }, s);
    expect(codesFor(result)).toContain('missing_required_field');
  });

  it('warns on a translated key whose base field the block does not define', () => {
    const result = validateStory({
      content: { component: 'page', headline: 'Hello', ghost__i18n__de: 'x' },
    }, s);
    const issue = result.issues.find(i => i.code === 'unknown_field');
    expect(issue?.severity).toBe('warning');
    expect(issue?.message).toBe('Unknown field "ghost__i18n__de" on component "page".');
  });
});

// A validator that fails on a union deep inside a value reports a bare
// `Invalid input`, which names nothing. When a more specific issue already
// covers the same value, the vague one is noise.
describe('validateStory — subsumed issues', () => {
  const page = defineBlock({
    name: 'page',
    is_root: true,
    fields: [defineField('body', { type: 'richtext' })],
  });
  const s = { blocks: { page, teaser } };

  it('drops the bare union message when a deeper issue explains the same node', () => {
    // `attrs.id` is missing, so the node fails the richtext union; the blok walk
    // separately finds the unknown component underneath it.
    const result = validateStory({
      content: {
        component: 'page',
        body: { type: 'doc', content: [{ type: 'blok', attrs: { body: [{ _uid: 'u', component: 'ghost' }] } }] },
      },
    }, s);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.code).toBe('unknown_component');
    expect(result.issues[0]?.path).toEqual(['content', 'body', 'content', 0, 'attrs', 'body', 0, 'component']);
  });

  it('keeps the bare union message when nothing deeper explains it', () => {
    // Same malformed node, but the embedded blok itself is valid, so the vague
    // issue is the only signal the node is wrong.
    const result = validateStory({
      content: {
        component: 'page',
        body: { type: 'doc', content: [{ type: 'blok', attrs: { body: [{ _uid: 'u', component: 'teaser', text: 'hi' }] } }] },
      },
    }, s);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.message).toBe('Invalid input.');
    expect(result.issues[0]?.path).toEqual(['content', 'body', 'content', 0]);
  });

  it('does not let an issue on a sibling path suppress an unrelated vague issue', () => {
    const twoFields = defineBlock({
      name: 'two',
      is_root: true,
      fields: [defineField('a', { type: 'richtext' }), defineField('b', { type: 'text' })],
    });
    const result = validateStory({
      content: {
        component: 'two',
        a: { type: 'doc', content: [{ type: 'blok', attrs: { body: [{ _uid: 'u', component: 'teaser', text: 'hi' }] } }] },
        b: 42,
      },
    }, { blocks: { two: twoFields, teaser } });
    expect(result.issues).toHaveLength(2);
    expect(result.issues.map(i => i.path)).toEqual([
      ['content', 'a', 'content', 0],
      ['content', 'b'],
    ]);
  });
});
