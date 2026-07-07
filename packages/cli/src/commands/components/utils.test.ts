import { describe, expect, it } from 'vitest';
import type { Component, ComponentFolder, InternalTag } from './constants';
import { collectAllDependencies } from './utils';

function component(partial: Partial<Component> & { name: string }): Component {
  return { id: 1, name: partial.name, schema: {}, ...partial } as Component;
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
