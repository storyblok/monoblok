import type { NormalizedSchema, RemoteSchemaData, SchemaData } from './types';
import { getMapiClient } from '../../api';
import { fetchAllPages } from '../../utils';

/** Reduces remote state to the common {@link NormalizedSchema} shape (drops component folders — not diffed). */
export function remoteToNormalized(remote: RemoteSchemaData): NormalizedSchema {
  return { components: remote.components, datasources: remote.datasources };
}

/** Reduces locally-loaded schema arrays to the common {@link NormalizedSchema} shape. */
export function localToNormalized(local: SchemaData): NormalizedSchema {
  return {
    components: new Map(local.components.map(c => [c.name, c])),
    datasources: new Map(local.datasources.map(d => [d.name, d])),
  };
}

/**
 * Fetches remote components, component folders, and datasources from the MAPI.
 * Component folders are fetched for `schema init` (to mirror groups as local
 * directories); `schema push` does not diff or manage them.
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
