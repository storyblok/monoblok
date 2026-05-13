import { describe, expect, it } from 'vitest';

import type { RemoteSchemaData, SchemaData } from '../types';
import { resolveFolderReferences } from './resolve-folders';

function makeComponent(name: string, componentGroupUuid?: string) {
  return {
    id: 1,
    name,
    created_at: '',
    updated_at: '',
    schema: {},
    ...(componentGroupUuid != null && { component_group_uuid: componentGroupUuid }),
  } as any;
}

function makeFolder(name: string, uuid?: string) {
  return { id: 1, name, uuid: uuid ?? name } as any;
}

function makeRemote(overrides: Partial<RemoteSchemaData> = {}): RemoteSchemaData {
  return {
    components: new Map(),
    componentFolders: new Map(),
    datasources: new Map(),
    ...overrides,
  };
}

describe('resolveFolderReferences', () => {
  it('should resolve component_group_uuid to remote folder UUID when folder exists remotely', () => {
    const local: SchemaData = {
      components: [makeComponent('hero', 'Layout')],
      componentFolders: [makeFolder('Layout')],
      datasources: [],
    };
    const remote = makeRemote({
      componentFolders: new Map([['Layout', makeFolder('Layout', 'remote-uuid-123')]]),
    });

    const { resolved, pendingFolderAssignments } = resolveFolderReferences(local, remote);

    expect(resolved.components[0].component_group_uuid).toBe('remote-uuid-123');
    expect(pendingFolderAssignments.size).toBe(0);
  });

  it('should mark as pending when folder exists locally but not remotely', () => {
    const local: SchemaData = {
      components: [makeComponent('hero', 'NewFolder')],
      componentFolders: [makeFolder('NewFolder')],
      datasources: [],
    };
    const remote = makeRemote();

    const { resolved, pendingFolderAssignments } = resolveFolderReferences(local, remote);

    // UUID unchanged — still the local one
    expect(resolved.components[0].component_group_uuid).toBe('NewFolder');
    expect(pendingFolderAssignments.get('NewFolder')).toEqual(['hero']);
  });

  it('should pass through component_group_uuid that does not match any local folder', () => {
    const local: SchemaData = {
      components: [makeComponent('hero', 'some-raw-api-uuid')],
      componentFolders: [],
      datasources: [],
    };
    const remote = makeRemote();

    const { resolved, pendingFolderAssignments } = resolveFolderReferences(local, remote);

    expect(resolved.components[0].component_group_uuid).toBe('some-raw-api-uuid');
    expect(pendingFolderAssignments.size).toBe(0);
  });

  it('should not modify components without component_group_uuid', () => {
    const local: SchemaData = {
      components: [makeComponent('hero')],
      componentFolders: [makeFolder('Layout')],
      datasources: [],
    };
    const remote = makeRemote();

    const { resolved } = resolveFolderReferences(local, remote);

    expect(resolved.components[0].component_group_uuid).toBeUndefined();
  });

  it('should handle multiple components referencing the same pending folder', () => {
    const local: SchemaData = {
      components: [
        makeComponent('hero', 'Layout'),
        makeComponent('banner', 'Layout'),
      ],
      componentFolders: [makeFolder('Layout')],
      datasources: [],
    };
    const remote = makeRemote();

    const { pendingFolderAssignments } = resolveFolderReferences(local, remote);

    expect(pendingFolderAssignments.get('Layout')).toEqual(['hero', 'banner']);
  });

  it('should resolve nested folder UUID (parent_uuid/name format)', () => {
    const local: SchemaData = {
      components: [makeComponent('button', 'Layout/Buttons')],
      componentFolders: [makeFolder('Buttons', 'Layout/Buttons')],
      datasources: [],
    };
    const remote = makeRemote({
      componentFolders: new Map([['Buttons', makeFolder('Buttons', 'remote-nested-uuid')]]),
    });

    const { resolved } = resolveFolderReferences(local, remote);

    expect(resolved.components[0].component_group_uuid).toBe('remote-nested-uuid');
  });

  it('should keep UUID as-is when it directly matches a remote folder UUID', () => {
    const local: SchemaData = {
      components: [makeComponent('hero', 'real-api-uuid-123')],
      componentFolders: [makeFolder('Layout', 'real-api-uuid-123')],
      datasources: [],
    };
    const remote = makeRemote({
      // Remote folder has same UUID but different name (renamed)
      componentFolders: new Map([['Layout Renamed', makeFolder('Layout Renamed', 'real-api-uuid-123')]]),
    });

    const { resolved, pendingFolderAssignments } = resolveFolderReferences(local, remote);

    // UUID matches remote directly — no replacement, supports renames
    expect(resolved.components[0].component_group_uuid).toBe('real-api-uuid-123');
    expect(pendingFolderAssignments.size).toBe(0);
  });

  it('should fall back to name match when UUID does not match any remote folder', () => {
    const local: SchemaData = {
      components: [makeComponent('hero', 'Layout')],
      componentFolders: [makeFolder('Layout')],
      datasources: [],
    };
    const remote = makeRemote({
      // Remote folder has same name but different UUID (different space)
      componentFolders: new Map([['Layout', makeFolder('Layout', 'different-space-uuid')]]),
    });

    const { resolved } = resolveFolderReferences(local, remote);

    // Name-based fallback resolves to the remote UUID
    expect(resolved.components[0].component_group_uuid).toBe('different-space-uuid');
  });
});
