import { mkdir, writeFile } from 'node:fs/promises';

import { dirname, join } from 'pathe';

import type { Component, ComponentFolder, Datasource } from '../../../types';
import { buildGroupPathByUuid } from '../folders';
import {
  generateComponentFile,
  generateDatasourceFile,
  generateFoldersFile,
  generateSchemaFile,
  resolveComponents,
  resolveDatasources,
  resolveFolders,
} from './generate-code';

/** Writes a file, creating parent directories as needed. */
async function writeFileWithDirs(filePath: string, content: string): Promise<void> {
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, content, 'utf-8');
}

/**
 * Writes all generated schema files to the target directory. A block's remote
 * component group is mirrored as a (slugified) directory *and* as an explicit
 * `folder: <folderVar>` reference on the block itself: a block in group
 * `My Layout` is written to `blocks/my-layout/<name>.ts` importing `myLayoutFolder`
 * from a root `folders.ts`; nested groups nest directories and folder parents.
 * The directory layout is local organization only — `schema push` does not read
 * it back as groups, the `folder` ref is what's authoritative. Ungrouped blocks
 * are written at the blocks root with no folder ref.
 */
export async function writeSchemaFiles(
  targetPath: string,
  components: Component[],
  componentFolders: ComponentFolder[],
  datasources: Datasource[],
): Promise<string[]> {
  const writtenFiles: string[] = [];
  const groupPathByUuid = buildGroupPathByUuid(componentFolders);

  // Each block's group directory segments (mirrors remote groups); ungrouped
  // blocks resolve to `[]` and are written at the blocks root.
  const componentSegments = components.map(comp =>
    comp.component_group_uuid ? groupPathByUuid.get(comp.component_group_uuid) ?? [] : [],
  );

  // Resolve unique variable and file names once so the written file path and
  // the schema.ts import path are the same value. File names are deduped per
  // group directory for blocks (kebab-casing is lossy); datasources are flat.
  const resolvedComponents = resolveComponents(components, componentSegments);
  const resolvedDatasources = resolveDatasources(datasources);
  const resolvedFolders = resolveFolders(componentFolders);
  const folderByUuid = new Map(resolvedFolders.map(r => [r.folder.uuid, r]));

  // Write component files into their group directory, with a `folder` ref
  // when the component belonged to a remote group.
  for (const { component, varName, fileName, segments } of resolvedComponents) {
    const filePath = join(targetPath, 'blocks', ...segments, `${fileName}.ts`);
    const folder = component.component_group_uuid ? folderByUuid.get(component.component_group_uuid) : undefined;
    const folderRef = folder && { varName: folder.varName, segments };
    await writeFileWithDirs(filePath, generateComponentFile(component, varName, folderRef));
    writtenFiles.push(filePath);
  }

  // Write datasource files
  for (const { datasource, varName, fileName } of resolvedDatasources) {
    const filePath = join(targetPath, 'datasources', `${fileName}.ts`);
    await writeFileWithDirs(filePath, generateDatasourceFile(datasource, varName));
    writtenFiles.push(filePath);
  }

  // Write folders.ts (only when the space has remote groups)
  if (resolvedFolders.length > 0) {
    const foldersPath = join(targetPath, 'folders.ts');
    await writeFileWithDirs(foldersPath, generateFoldersFile(resolvedFolders));
    writtenFiles.push(foldersPath);
  }

  // Write schema.ts (entry point with schema object, types, and Story alias)
  const schemaPath = join(targetPath, 'schema.ts');
  await writeFileWithDirs(schemaPath, generateSchemaFile(resolvedComponents, resolvedDatasources, resolvedFolders));
  writtenFiles.push(schemaPath);

  return writtenFiles;
}
