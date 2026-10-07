import { getDatasourceFilename } from "@storyblok/utils/local-files";

import type { Datasource } from "./types";

import { readLocalJsonFiles, writeLocalJsonFile } from "./local-utils";

export async function getLocalDatasources(dir: string): Promise<Datasource[]> {
  return readLocalJsonFiles<Datasource>(dir);
}

export async function updateLocalDatasource(dir: string, datasource: Datasource): Promise<void> {
  await writeLocalJsonFile(dir, getDatasourceFilename(datasource), datasource);
}

export type { Datasource };
