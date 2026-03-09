import type { Datasource } from '@storyblok/management-api-client/resources/datasources';

import { readLocalJsonFiles, writeLocalJsonFile } from './local-utils';

function getDatasourceFilename(
  datasource: Pick<Datasource, 'slug' | 'id'>,
): string {
  return `${datasource.slug}_${datasource.id}.json`;
}

export async function getLocalDatasources(dir: string): Promise<Datasource[]> {
  return readLocalJsonFiles<Datasource>(dir);
}

export async function updateLocalDatasource(
  dir: string,
  datasource: Datasource,
): Promise<void> {
  await writeLocalJsonFile(dir, getDatasourceFilename(datasource), datasource);
}

export type { Datasource };
