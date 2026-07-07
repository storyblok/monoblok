import { describe, expect, it } from 'vitest';
import type { Component, ComponentFolder, InternalTag, SpaceComponentsData } from './constants';
import { CommandError } from '../../utils';
import { collectAllDependencies, filterSpaceData, resolveGroupSelector, resolveTagSelector } from './utils';

function component(partial: Partial<Component> & { name: string }): Component {
  return { id: 1, name: partial.name, schema: {}, ...partial } as Component;
}

function spaceData(components: Component[], extras: Partial<SpaceComponentsData> = {}): SpaceComponentsData {
  return { components, groups: [], internalTags: [], presets: [], datasources: [], ...extras };
}

describe('collectAllDependencies (option A)', () => {
  it('drops sibling components referenced via component_whitelist', () => {
    const checkout = component({
      name: 'checkout',
      id: 1,
      schema: { body: { type: 'bloks', component_whitelist: ['richtext'] } },
    });
    const richtext = component({ name: 'richtext', id: 2 });

    const { filteredComponents } = collectAllDependencies(
      [checkout],
      [checkout, richtext],
      [],
      [],
    );

    expect(filteredComponents.map(c => c.name)).toEqual(['checkout']);
  });

  it('keeps the assigned group and its ancestors', () => {
    const child: ComponentFolder = { id: 20, uuid: 'child-uuid', name: 'Child', parent_uuid: 'parent-uuid', parent_id: 10 };
    const parent: ComponentFolder = { id: 10, uuid: 'parent-uuid', name: 'Parent' };
    const checkout = component({ name: 'checkout', id: 1, component_group_uuid: 'child-uuid' });

    const { filteredGroups } = collectAllDependencies([checkout], [checkout], [child, parent], []);

    expect(filteredGroups.map(g => g.uuid).sort()).toEqual(['child-uuid', 'parent-uuid']);
  });

  it('keeps groups and tags referenced by schema whitelists, plus group ancestors', () => {
    const parent: ComponentFolder = { id: 10, uuid: 'wl-parent', name: 'WLParent' };
    const wlGroup: ComponentFolder = { id: 11, uuid: 'wl-group', name: 'WLGroup', parent_uuid: 'wl-parent', parent_id: 10 };
    const tag: InternalTag = { id: 5, name: 'beta' };
    const checkout = component({
      name: 'checkout',
      id: 1,
      schema: {
        body: {
          type: 'bloks',
          component_group_whitelist: ['wl-group'],
          component_tag_whitelist: [5],
        },
      },
    });

    const { filteredGroups, filteredTags } = collectAllDependencies(
      [checkout],
      [checkout],
      [wlGroup, parent],
      [tag],
    );

    expect(filteredGroups.map(g => g.uuid).sort()).toEqual(['wl-group', 'wl-parent']);
    expect(filteredTags.map(t => t.id)).toEqual([5]);
  });

  it('keeps directly assigned tags', () => {
    const tag: InternalTag = { id: 7, name: 'checkout-team' };
    const checkout = component({ name: 'checkout', id: 1, internal_tag_ids: ['7'] });

    const { filteredTags } = collectAllDependencies([checkout], [checkout], [], [tag]);

    expect(filteredTags.map(t => t.id)).toEqual([7]);
  });
});

const groups: ComponentFolder[] = [
  { id: 1, uuid: 'marketing', name: 'Marketing' },
  { id: 2, uuid: 'checkout', name: 'Checkout', parent_uuid: 'marketing', parent_id: 1 },
  { id: 3, uuid: 'checkout-forms', name: 'Forms', parent_uuid: 'checkout', parent_id: 2 },
  { id: 4, uuid: 'blog', name: 'Blog' },
  { id: 5, uuid: 'blog-forms', name: 'Forms', parent_uuid: 'blog', parent_id: 4 },
];

describe('resolveGroupSelector', () => {
  it('resolves an unambiguous name to its subtree of uuids', () => {
    expect([...resolveGroupSelector(groups, 'Checkout')].sort())
      .toEqual(['checkout', 'checkout-forms']);
  });

  it('resolves a Parent/Child path', () => {
    expect([...resolveGroupSelector(groups, 'Blog/Forms')]).toEqual(['blog-forms']);
  });

  it('includes descendants of the resolved group', () => {
    expect([...resolveGroupSelector(groups, 'Marketing')].sort())
      .toEqual(['checkout', 'checkout-forms', 'marketing']);
  });

  it('throws on an ambiguous bare name', () => {
    expect(() => resolveGroupSelector(groups, 'Forms')).toThrow(/ambiguous/i);
  });

  it('throws when no group matches', () => {
    expect(() => resolveGroupSelector(groups, 'Nope')).toThrow(/no component group/i);
  });

  it('throws on an ambiguous bare name without hanging when parent_uuid chain is cyclic', () => {
    const cyclicGroups: ComponentFolder[] = [
      { id: 1, uuid: 'a', name: 'Forms', parent_uuid: 'b' },
      { id: 2, uuid: 'b', name: 'Forms', parent_uuid: 'a' },
    ];
    expect(() => resolveGroupSelector(cyclicGroups, 'Forms')).toThrow(CommandError);
  });

  it('throws when the selector produces no path segments', () => {
    expect(() => resolveGroupSelector(groups, '/')).toThrow(CommandError);
  });
});

describe('resolveTagSelector', () => {
  const tags: InternalTag[] = [
    { id: 10, name: 'beta' },
    { id: 11, name: 'checkout-team' },
  ];

  it('maps names to ids', () => {
    expect([...resolveTagSelector(tags, ['beta', 'checkout-team'])].sort((a, b) => a - b))
      .toEqual([10, 11]);
  });

  it('throws when a tag name does not exist', () => {
    expect(() => resolveTagSelector(tags, ['ghost'])).toThrow(/ghost/);
  });
});

describe('filterSpaceData', () => {
  const a = component({ name: 'checkout-form', id: 1, component_group_uuid: 'checkout', internal_tag_ids: ['10'] });
  const b = component({ name: 'checkout-cart', id: 2, component_group_uuid: 'checkout', internal_tag_ids: [] });
  const c = component({ name: 'hero', id: 3, component_group_uuid: 'marketing', internal_tag_ids: ['10'] });

  it('combines selector types with AND', () => {
    const result = filterSpaceData(spaceData([a, b, c]), {
      groupUuids: new Set(['checkout']),
      tagIds: new Set([10]),
    });
    expect(result.components.map(x => x.name)).toEqual(['checkout-form']);
  });

  it('matches tags with OR within the tag set', () => {
    const result = filterSpaceData(spaceData([a, b, c]), { tagIds: new Set([10]) });
    expect(result.components.map(x => x.name).sort()).toEqual(['checkout-form', 'hero']);
  });

  it('applies the glob on top of other selectors', () => {
    const result = filterSpaceData(spaceData([a, b, c]), {
      filter: 'checkout-*',
      groupUuids: new Set(['checkout']),
    });
    expect(result.components.map(x => x.name).sort()).toEqual(['checkout-cart', 'checkout-form']);
  });

  it('returns empty data when nothing matches', () => {
    const result = filterSpaceData(spaceData([a, b, c]), { groupUuids: new Set(['nope']) });
    expect(result.components).toEqual([]);
  });
});
