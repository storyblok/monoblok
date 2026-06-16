import type { DatasourceEntry, Preset } from '../../types';
import type { RemoteSchemaData } from './types';
import { getMapiClient } from '../../api';
import { fetchAllPages } from '../../utils';

/** Fetches remote components, component folders, datasources, presets, and datasource entries from the MAPI. */
export async function fetchRemoteSchema(spaceId: string) {
  const client = getMapiClient();
  const spaceIdNum = Number(spaceId);

  const [componentsRes, foldersRes, rawDatasources, presetsRes] = await Promise.all([
    client.components.list({ path: { space_id: spaceIdNum }, throwOnError: true }),
    client.componentFolders.list({ path: { space_id: spaceIdNum }, throwOnError: true }),
    fetchAllPages(
      (page: number) => client.datasources.list({ path: { space_id: spaceIdNum }, query: { page }, throwOnError: true }),
      data => data?.datasources ?? [],
    ),
    client.presets.list({ path: { space_id: spaceIdNum }, throwOnError: true }),
  ]);

  const rawComponents = componentsRes.data?.components ?? [];
  const rawComponentFolders = foldersRes.data?.component_groups ?? [];
  const rawPresets: Preset[] = presetsRes.data?.presets ?? [];

  // Datasource entries are scoped per datasource — fetch them in parallel by id.
  const entriesByDatasourceId = new Map<number, DatasourceEntry[]>();
  await Promise.all(rawDatasources.map(async (ds) => {
    if (ds.id == null) { return; }
    const res = await client.datasourceEntries.list({
      path: { space_id: spaceIdNum },
      query: { datasource_id: ds.id },
      throwOnError: true,
    });
    entriesByDatasourceId.set(ds.id, res.data?.datasource_entries ?? []);
  }));

  const remote: RemoteSchemaData = {
    components: new Map(rawComponents.map(c => [c.name, c])),
    componentFolders: new Map(rawComponentFolders.map(f => [f.name, f])),
    datasources: new Map(rawDatasources.map(d => [d.name, d])),
  };

  return { remote, rawComponents, rawComponentFolders, rawDatasources, rawPresets, entriesByDatasourceId };
}
