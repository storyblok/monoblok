import { mkdir, writeFile } from 'node:fs/promises';

import { dirname, join } from 'pathe';

import type { Component, ComponentFolder, Datasource } from '../../../types';
import { buildGroupPathByUuid } from '../folders';
import {
  componentFileName,
  componentVarName,
  datasourceFileName,
  datasourceVarName,
  generateComponentFile,
  generateDatasourceFile,
  generateSchemaFile,
  resolveVarNames,
} from './generate-code';

/** Writes a file, creating parent directories as needed. */
async function writeFileWithDirs(filePath: string, content: string): Promise<void> {
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, content, 'utf-8');
}

/**
 * Writes all generated schema files to the target directory. A block's remote
 * component group is mirrored as a (slugified) directory: a block in group
 * `My Layout` is written to `blocks/my-layout/<name>.ts`; nested groups nest
 * directories. This layout is local organization only — `schema push` does not
 * read it back as groups. Ungrouped blocks are written at the blocks root.
 */
export async function writeSchemaFiles(
  targetPath: string,
  components: Component[],
  componentFolders: ComponentFolder[],
  datasources: Datasource[],
): Promise<string[]> {
  const writtenFiles: string[] = [];
  const groupPathByUuid = buildGroupPathByUuid(componentFolders);
  const groupPathByComponentName = new Map<string, string[]>();
  const componentVarNames = resolveVarNames(components.map(c => c.name), componentVarName);
  const datasourceVarNames = resolveVarNames(datasources.map(d => d.name), datasourceVarName);

  // Write component files into their group directory
  for (const [i, comp] of components.entries()) {
    const segments = comp.component_group_uuid ? groupPathByUuid.get(comp.component_group_uuid) ?? [] : [];
    if (segments.length > 0) { groupPathByComponentName.set(comp.name, segments); }

    const fileName = componentFileName(comp.name);
    const filePath = join(targetPath, 'blocks', ...segments, `${fileName}.ts`);
    await writeFileWithDirs(filePath, generateComponentFile(comp, componentVarNames[i]));
    writtenFiles.push(filePath);
  }

  // Write datasource files
  for (const [i, ds] of datasources.entries()) {
    const fileName = datasourceFileName(ds);
    const filePath = join(targetPath, 'datasources', `${fileName}.ts`);
    await writeFileWithDirs(filePath, generateDatasourceFile(ds, datasourceVarNames[i]));
    writtenFiles.push(filePath);
  }

  // Write schema.ts (entry point with schema object, types, and Story alias)
  const schemaPath = join(targetPath, 'schema.ts');
  await writeFileWithDirs(
    schemaPath,
    generateSchemaFile(components, datasources, groupPathByComponentName, componentVarNames, datasourceVarNames),
  );
  writtenFiles.push(schemaPath);

  return writtenFiles;
}
