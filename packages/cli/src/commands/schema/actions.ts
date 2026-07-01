import type { LocalFolder, NormalizedSchema, RemoteSchemaData, SchemaData } from './types';
import { getMapiClient } from '../../api';
import { fetchAllPages } from '../../utils';
import { buildGroupPathByUuid } from './folders';

/**
 * Reduces remote state to the common {@link NormalizedSchema} shape. Remote
 * component groups are resolved into slug-path identity space (via their uuid
 * parent chain) so folders diff against local folders in the same terms.
 */
export function remoteToNormalized(remote: RemoteSchemaData): NormalizedSchema {
  const groupPathByUuid = buildGroupPathByUuid([...remote.componentFolders.values()]);
  const folders = new Map<string, LocalFolder>();
  for (const folder of remote.componentFolders.values()) {
    const segments = groupPathByUuid.get(folder.uuid);
    if (!segments || segments.length === 0) { continue; }
    const path = segments.join('/');
    folders.set(path, {
      name: folder.name,
      path,
      parentPath: segments.length > 1 ? segments.slice(0, -1).join('/') : null,
    });
  }
  return { components: remote.components, datasources: remote.datasources, folders };
}

/** Reduces locally-loaded schema arrays to the common {@link NormalizedSchema} shape. */
export function localToNormalized(local: SchemaData): NormalizedSchema {
  return {
    components: new Map(local.components.map(c => [c.name, c])),
    datasources: new Map(local.datasources.map(d => [d.name, d])),
    folders: new Map(local.folders.map(f => [f.path, f])),
  };
}

/**
 * Fetches remote components, component folders, and datasources from the MAPI.
 * Component folders are used by `schema init` (to mirror groups as local
 * directories) and by `schema push`, which diffs and manages them: creating,
 * resolving membership against, and (with `--delete`) removing component groups.
 */
export async function fetchRemoteSchema(spaceId: string) {
  const client = getMapiClient();
  const spaceIdNum = Number(spaceId);

  const [componentsRes, foldersRes, rawDatasources] = await Promise.all([
    client.components.list({ path: { space_id: spaceIdNum }, throwOnError: true }),
    client.componentFolders.list({ path: { space_id: spaceIdNum }, throwOnError: true }),
    fetchAllPages(
      (page: number) => client.datasources.list({ path: { space_id: spaceIdNum }, query: { page }, throwOnError: true }),
      data => data?.datasources ?? [],
    ),
  ]);

  const rawComponents = componentsRes.data?.components ?? [];
  const rawComponentFolders = foldersRes.data?.component_groups ?? [];

  const remote: RemoteSchemaData = {
    components: new Map(rawComponents.map(c => [c.name, c])),
    componentFolders: new Map(rawComponentFolders.map(f => [f.name, f])),
    datasources: new Map(rawDatasources.map(d => [d.name, d])),
  };

  return { remote, rawComponents, rawComponentFolders, rawDatasources };
}
