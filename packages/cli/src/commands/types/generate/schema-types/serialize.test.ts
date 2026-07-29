import { describe, expect, it } from 'vitest';

import type { Component } from '../../../../types';
import type { SerializeContext } from './serialize';
import { serializeBlockDefinition } from './serialize';

function component(overrides: Partial<Component> = {}): Component {
  return {
    id: 1,
    name: 'hero',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-02T00:00:00.000Z',
    is_root: false,
    is_nestable: true,
    schema: {},
    ...overrides,
  };
}

/** Context for a space whose only component is the one under test. */
function context(overrides: Partial<SerializeContext> = {}): SerializeContext {
  return {
    displayPathByUuid: new Map<string, string>(),
    knownBlockNames: new Set(['hero']),
    ...overrides,
  };
}

const emptyContext = context();

describe('serializeBlockDefinition', () => {
  it('widens id/created_at/updated_at and keeps name/is_root/is_nestable literal', () => {
    const result = serializeBlockDefinition(component(), emptyContext);

    expect(result.componentName).toBe('hero');
    expect(result.definitionBody).toBe([
      '{',
      '  readonly id: number;',
      '  created_at: string;',
      '  updated_at: string;',
      '  name: \'hero\';',
      '  is_root: false;',
      '  is_nestable: true;',
      '  fields: [];',
      '}',
    ].join('\n'));
  });

  it('emits fields ordered by pos, keeping only type-relevant keys', () => {
    const result = serializeBlockDefinition(component({
      schema: {
        body: { type: 'bloks', pos: 1, description: 'ignored', translatable: true },
        headline: { type: 'text', pos: 0, required: true, default_value: 'ignored' },
      },
    }), emptyContext);

    expect(result.definitionBody).toContain([
      '  fields: [',
      '    { name: \'headline\'; type: \'text\'; required: true },',
      '    { name: \'body\'; type: \'bloks\' },',
      '  ];',
    ].join('\n'));
  });

  it('omits required when it is not true', () => {
    const result = serializeBlockDefinition(component({
      schema: { headline: { type: 'text', required: false } },
    }), emptyContext);

    expect(result.definitionBody).toContain('{ name: \'headline\'; type: \'text\' }');
  });

  it('maps component_whitelist to an allow tuple', () => {
    const result = serializeBlockDefinition(component({
      schema: { body: { type: 'bloks', component_whitelist: ['grid', 'teaser'] } },
    }), context({ knownBlockNames: new Set(['hero', 'grid', 'teaser']) }));

    expect(result.definitionBody).toContain('{ name: \'body\'; type: \'bloks\'; allow: [\'grid\', \'teaser\'] }');
  });

  it('maps a group whitelist to allow folder entries using display paths', () => {
    const result = serializeBlockDefinition(component({
      schema: { body: { type: 'bloks', component_group_whitelist: ['uuid-1'] } },
    }), context({ displayPathByUuid: new Map([['uuid-1', 'My Layout/Heros']]) }));

    expect(result.definitionBody).toContain('allow: [{ folder: \'My Layout/Heros\' }]');
  });

  it('omits allow when a group whitelist cannot be resolved', () => {
    const result = serializeBlockDefinition(component({
      schema: { body: { type: 'bloks', component_group_whitelist: ['unknown'] } },
    }), emptyContext);

    expect(result.definitionBody).toContain('{ name: \'body\'; type: \'bloks\' }');
    expect(result.definitionBody).not.toContain('allow');
  });

  it('emits the block folder literal from its component group', () => {
    const result = serializeBlockDefinition(
      component({ component_group_uuid: 'uuid-1' }),
      context({ displayPathByUuid: new Map([['uuid-1', 'My Layout']]) }),
    );

    expect(result.definitionBody).toContain('  folder: \'My Layout\';');
  });

  it('keeps field_type on custom fields and reports it', () => {
    const result = serializeBlockDefinition(component({
      schema: { accent: { type: 'custom', field_type: 'storyblok-colorpicker' } },
    }), emptyContext);

    expect(result.definitionBody).toContain('{ name: \'accent\'; type: \'custom\'; field_type: \'storyblok-colorpicker\' }');
    expect(result.customFieldTypes).toEqual(['storyblok-colorpicker']);
  });

  it('escapes quotes in names and values', () => {
    const result = serializeBlockDefinition(component({
      schema: { 'it\'s': { type: 'text' } },
    }), emptyContext);

    expect(result.definitionBody).toContain('name: \'it\\\'s\'');
  });

  it('emits is_nestable true when the wire omits it, and false when explicit', () => {
    expect(serializeBlockDefinition(component({ is_nestable: undefined }), emptyContext).definitionBody)
      .toContain('is_nestable: true;');
    expect(serializeBlockDefinition(component({ is_nestable: false }), emptyContext).definitionBody)
      .toContain('is_nestable: false;');
  });

  it('omits allow when the restriction is switched off, for names and for groups', () => {
    const names = serializeBlockDefinition(component({
      schema: {
        body: { type: 'bloks', restrict_components: false, component_whitelist: ['grid'] },
      },
    }), context({ knownBlockNames: new Set(['hero', 'grid']) }));

    // The live case: Storyblok strips a stale name whitelist when the flag is
    // false, but never strips a group whitelist, so this state does reach us.
    const groups = serializeBlockDefinition(component({
      schema: {
        body: {
          type: 'bloks',
          restrict_components: false,
          restrict_type: 'groups',
          component_group_whitelist: ['uuid-1'],
        },
      },
    }), context({ displayPathByUuid: new Map([['uuid-1', 'My Layout']]) }));

    expect(names.definitionBody).not.toContain('allow');
    expect(groups.definitionBody).not.toContain('allow');
  });

  it('keeps allow when restrict_components is absent, which the backend enforces', () => {
    const result = serializeBlockDefinition(component({
      schema: { body: { type: 'bloks', component_whitelist: ['grid'] } },
    }), context({ knownBlockNames: new Set(['hero', 'grid']) }));

    expect(result.definitionBody).toContain('allow: [\'grid\']');
  });

  it('emits allow on richtext but not on other whitelisted field types', () => {
    const richtext = serializeBlockDefinition(component({
      schema: { body: { type: 'richtext', component_whitelist: ['grid'] } },
    }), context({ knownBlockNames: new Set(['hero', 'grid']) }));

    // A multilink's component_whitelist holds content type names, not block
    // names, so emitting it would put a misleading list in the output.
    const multilink = serializeBlockDefinition(component({
      schema: { link: { type: 'multilink', component_whitelist: ['page'] } },
    }), context({ knownBlockNames: new Set(['hero', 'page']) }));

    expect(richtext.definitionBody).toContain('allow: [\'grid\']');
    expect(multilink.definitionBody).toContain('{ name: \'link\'; type: \'multilink\' }');
    expect(multilink.definitionBody).not.toContain('allow');
  });

  it('drops allow entries naming a block the space does not have', () => {
    const result = serializeBlockDefinition(component({
      schema: { body: { type: 'bloks', component_whitelist: ['grid', 'deleted'] } },
    }), context({ knownBlockNames: new Set(['hero', 'grid']) }));

    expect(result.definitionBody).toContain('allow: [\'grid\']');
  });

  it('omits allow entirely when no whitelisted block still exists', () => {
    // An `allow` of only unknown names would resolve the field to `never[]`
    // through `ApplyAllow`, rejecting every possible value.
    const result = serializeBlockDefinition(component({
      schema: { body: { type: 'bloks', component_whitelist: ['deleted', 'gone'] } },
    }), emptyContext);

    expect(result.definitionBody).toContain('{ name: \'body\'; type: \'bloks\' }');
    expect(result.definitionBody).not.toContain('allow');
  });

  it('keeps tab fields, which resolve to never downstream', () => {
    const result = serializeBlockDefinition(component({
      schema: { general: { type: 'tab' } },
    }), emptyContext);

    expect(result.definitionBody).toContain('{ name: \'general\'; type: \'tab\' }');
  });
});
