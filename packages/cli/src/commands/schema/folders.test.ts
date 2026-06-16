import { describe, expect, it } from 'vitest';

import type { ComponentFolder } from '../../types';
import { deriveFolderNodes, groupUuidForBlock, pathKey, resolveExistingFolders } from './folders';

function folder(partial: Partial<ComponentFolder> & { name: string; id: number }): ComponentFolder {
  return { uuid: `${partial.name}-uuid`, parent_id: null, parent_uuid: null, ...partial };
}

describe('deriveFolderNodes', () => {
  it('produces one node per distinct path prefix, shallow-first', () => {
    const nodes = deriveFolderNodes(new Map([
      ['hero', ['content', 'marketing']],
      ['header', ['layout']],
    ]));

    expect(nodes.map(n => n.path)).toEqual([
      ['content'],
      ['layout'],
      ['content', 'marketing'],
    ]);
    expect(nodes[2]).toMatchObject({ name: 'marketing', parentPath: ['content'] });
  });

  it('ignores blocks with no group path', () => {
    const nodes = deriveFolderNodes(new Map([['page', []]]));
    expect(nodes).toEqual([]);
  });
});

describe('resolveExistingFolders', () => {
  it('matches existing folders by (name, parent_id) walking the chain', () => {
    const content = folder({ name: 'content', id: 1 });
    const marketing = folder({ name: 'marketing', id: 2, parent_id: 1, parent_uuid: 'content-uuid' });
    const nodes = deriveFolderNodes(new Map([['hero', ['content', 'marketing']]]));

    const { resolved, toCreate } = resolveExistingFolders(nodes, [content, marketing]);

    expect(toCreate).toEqual([]);
    expect(resolved.get(pathKey(['content']))).toEqual({ id: 1, uuid: 'content-uuid' });
    expect(resolved.get(pathKey(['content', 'marketing']))).toEqual({ id: 2, uuid: 'marketing-uuid' });
  });

  it('queues missing folders for creation (parent and child)', () => {
    const nodes = deriveFolderNodes(new Map([['hero', ['content', 'marketing']]]));
    const { resolved, toCreate } = resolveExistingFolders(nodes, []);

    expect(resolved.size).toBe(0);
    expect(toCreate.map(n => n.path)).toEqual([['content'], ['content', 'marketing']]);
  });

  it('does not match a same-named folder under a different parent', () => {
    // A root "marketing" exists, but the block wants content/marketing.
    const rootMarketing = folder({ name: 'marketing', id: 9 });
    const content = folder({ name: 'content', id: 1 });
    const nodes = deriveFolderNodes(new Map([['hero', ['content', 'marketing']]]));

    const { resolved, toCreate } = resolveExistingFolders(nodes, [rootMarketing, content]);

    expect(resolved.get(pathKey(['content']))).toEqual({ id: 1, uuid: 'content-uuid' });
    expect(toCreate.map(n => n.path)).toEqual([['content', 'marketing']]);
  });
});

describe('groupUuidForBlock', () => {
  it('returns the deepest folder uuid', () => {
    const resolved = new Map([[pathKey(['content', 'marketing']), { id: 2, uuid: 'marketing-uuid' }]]);
    expect(groupUuidForBlock(['content', 'marketing'], resolved)).toBe('marketing-uuid');
  });

  it('returns undefined for ungrouped blocks or unresolved folders', () => {
    expect(groupUuidForBlock([], new Map())).toBeUndefined();
    expect(groupUuidForBlock(undefined, new Map())).toBeUndefined();
    expect(groupUuidForBlock(['ghost'], new Map())).toBeUndefined();
  });
});
