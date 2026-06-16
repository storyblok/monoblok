import { describe, expect, it } from 'vitest';

import type { ComponentFolder } from '../../../types';
import type { RemoteSchemaData, SchemaData } from '../types';
import { pathKey } from '../folders';
import { resolveFolderReferences } from './resolve-folders';

function makeComponent(name: string, componentGroupUuid?: string) {
  return {
    id: 1,
    name,
    created_at: '',
    updated_at: '',
    schema: {},
    ...(componentGroupUuid != null && { component_group_uuid: componentGroupUuid }),
  } as unknown as SchemaData['components'][number];
}

function makeFolder(partial: Partial<ComponentFolder> & { name: string; id: number }): ComponentFolder {
  return { uuid: `${partial.name}-uuid`, parent_id: null, parent_uuid: null, ...partial };
}

function makeLocal(overrides: Partial<SchemaData> = {}): SchemaData {
  return {
    components: [],
    componentFolders: [],
    datasources: [],
    folderPathByComponentName: new Map(),
    presetsByComponentName: new Map(),
    entriesByDatasourceName: new Map(),
    ...overrides,
  };
}

function makeRemote(folders: ComponentFolder[] = []): RemoteSchemaData {
  return {
    components: new Map(),
    componentFolders: new Map(folders.map(f => [f.name, f])),
    datasources: new Map(),
  };
}

describe('resolveFolderReferences', () => {
  it('sets component_group_uuid when the block\'s group already exists remotely', () => {
    const local = makeLocal({
      components: [makeComponent('hero')],
      folderPathByComponentName: new Map([['hero', ['layout']]]),
    });
    const remote = makeRemote([makeFolder({ name: 'layout', id: 7, uuid: 'remote-layout' })]);

    const { resolved, foldersToCreate } = resolveFolderReferences(local, remote);

    expect(resolved.components[0].component_group_uuid).toBe('remote-layout');
    expect(foldersToCreate).toEqual([]);
  });

  it('queues missing folders for creation and leaves the block unassigned for now', () => {
    const local = makeLocal({
      components: [makeComponent('hero')],
      folderPathByComponentName: new Map([['hero', ['layout']]]),
    });

    const { resolved, foldersToCreate } = resolveFolderReferences(local, makeRemote());

    expect(resolved.components[0].component_group_uuid).toBeUndefined();
    expect(foldersToCreate.map(n => n.path)).toEqual([['layout']]);
  });

  it('resolves nested groups by (name, parent_id)', () => {
    const local = makeLocal({
      components: [makeComponent('button')],
      folderPathByComponentName: new Map([['button', ['layout', 'buttons']]]),
    });
    const remote = makeRemote([
      makeFolder({ name: 'layout', id: 1, uuid: 'layout-uuid' }),
      makeFolder({ name: 'buttons', id: 2, parent_id: 1, parent_uuid: 'layout-uuid', uuid: 'buttons-uuid' }),
    ]);

    const { resolved, folderResolution } = resolveFolderReferences(local, remote);

    expect(resolved.components[0].component_group_uuid).toBe('buttons-uuid');
    expect(folderResolution.get(pathKey(['layout', 'buttons']))).toEqual({ id: 2, uuid: 'buttons-uuid' });
  });

  it('passes an explicit component_group_uuid through untouched (escape hatch wins)', () => {
    const local = makeLocal({
      components: [makeComponent('hero', 'raw-api-uuid')],
      folderPathByComponentName: new Map([['hero', ['layout']]]),
    });
    const remote = makeRemote([makeFolder({ name: 'layout', id: 7, uuid: 'remote-layout' })]);

    const { resolved } = resolveFolderReferences(local, remote);

    expect(resolved.components[0].component_group_uuid).toBe('raw-api-uuid');
  });

  it('leaves ungrouped blocks without a group', () => {
    const local = makeLocal({ components: [makeComponent('page')] });

    const { resolved } = resolveFolderReferences(local, makeRemote());

    expect(resolved.components[0].component_group_uuid).toBeUndefined();
  });
});
