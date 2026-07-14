import type { RemoteSchemaData } from './types';
import { getMapiClient } from '../../api';
import { fetchAllPages } from '../../utils';

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
