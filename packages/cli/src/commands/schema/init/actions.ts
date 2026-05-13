import { mkdir, writeFile } from 'node:fs/promises';

import { dirname, join } from 'pathe';

import type { Component, ComponentFolder, Datasource } from '../../../types';
import {
  componentFileName,
  datasourceFileName,
  folderFileName,
  generateComponentFile,
  generateDatasourceFile,
  generateFolderFile,
  generateSchemaFile,
} from './generate-code';

/** Writes a file, creating parent directories as needed. */
async function writeFileWithDirs(filePath: string, content: string): Promise<void> {
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, content, 'utf-8');
}

/** Writes all generated schema files to the target directory. */
export async function writeSchemaFiles(
  targetPath: string,
  components: Component[],
  componentFolders: ComponentFolder[],
  datasources: Datasource[],
): Promise<string[]> {
  const writtenFiles: string[] = [];

  // Write component files
  for (const comp of components) {
    const fileName = componentFileName(comp.name);
    const filePath = join(targetPath, 'components', `${fileName}.ts`);
    await writeFileWithDirs(filePath, generateComponentFile(comp, componentFolders));
    writtenFiles.push(filePath);
  }

  // Write component folder files
  for (const folder of componentFolders) {
    const fileName = folderFileName(folder.name);
    const filePath = join(targetPath, 'components', 'folders', `${fileName}.ts`);
    await writeFileWithDirs(filePath, generateFolderFile(folder));
    writtenFiles.push(filePath);
  }

  // Write datasource files
  for (const ds of datasources) {
    const fileName = datasourceFileName(ds);
    const filePath = join(targetPath, 'datasources', `${fileName}.ts`);
    await writeFileWithDirs(filePath, generateDatasourceFile(ds));
    writtenFiles.push(filePath);
  }

  // Write schema.ts (entry point with schema object, types, and Story alias)
  const schemaPath = join(targetPath, 'schema.ts');
  await writeFileWithDirs(schemaPath, generateSchemaFile(components, componentFolders, datasources));
  writtenFiles.push(schemaPath);

  return writtenFiles;
}
