import type { Component, ComponentFolder, Datasource } from "../../../types";
import { slugify } from "../../../utils/format";
import { buildGroupPathByUuid } from "../folders";
import { resolveGroupWhitelistEntries, toDslField } from "../to-dsl-field";
import {
  COMPONENT_STRIP_KEYS,
  componentFileName,
  DATASOURCE_STRIP_KEYS,
  formatValue,
  INDENT,
  isRecord,
  quoteString,
  RawCode,
  resolveFileNames,
  resolveVarNames,
  sortSchemaByPos,
  stripKeys,
  toKebabCase,
} from "../utils";

export { componentFileName, resolveFileNames, resolveVarNames } from "../utils";

/** Fields to strip from individual schema field entries (`pos` is implicit in array order). */
const FIELD_STRIP_KEYS = new Set(["id", "pos"]);

/**
 * Converts an arbitrary name into a valid camelCase JS identifier.
 * `slugify` reduces the input to `[a-z0-9_-]` (symbols stripped, spaces → `-`);
 * we then camelCase across `_`/`-` runs and guard against an empty or
 * leading-digit result so the output is always usable as an identifier.
 */
function toCamelCaseIdentifier(str: string): string {
  const camel = slugify(str)
    .replace(/^[_-]+/, "")
    .replace(/[_-]+(.)/g, (_, char: string) => char.toUpperCase());
  if (!camel) {
    return "_";
  }
  return /^\d/.test(camel) ? `_${camel}` : camel;
}

/** Returns the variable name for a component. e.g. `'teaser_list'` -> `'teaserListBlock'` */
export function componentVarName(name: string): string {
  return `${toCamelCaseIdentifier(name)}Block`;
}

/** Returns the variable name for a datasource. e.g. `'Categories'` -> `'categoriesDatasource'` */
export function datasourceVarName(name: string): string {
  return `${toCamelCaseIdentifier(name)}Datasource`;
}

/** Returns the variable name for a folder. e.g. `'My Layout'` -> `'myLayoutFolder'` */
export function folderVarName(name: string): string {
  return `${toCamelCaseIdentifier(name)}Folder`;
}

/** Returns the file name (without extension) for a datasource, using slug if available. */
export function datasourceFileName(
  datasource: Pick<Datasource, "name"> & { slug?: string },
): string {
  return toKebabCase(datasource.slug || datasource.name);
}

/**
 * A component paired with the identifiers derived for it: a unique `export`
 * variable name, a unique file name (deduped within its group directory), and
 * the group-path `segments` that place its file. Resolved once so the written
 * file path and the `schema.ts` import path are the same value by construction.
 */
export interface ResolvedComponent {
  component: Component;
  varName: string;
  fileName: string;
  segments: string[];
}

/** A datasource paired with its unique variable name and (flat) file name. */
export interface ResolvedDatasource {
  datasource: Datasource;
  varName: string;
  fileName: string;
}

/**
 * Resolves each component to its unique variable and file names.
 * `segmentsByIndex` gives the group-path directory segments per component
 * (index-aligned to `components`); file-name uniqueness is scoped to that
 * directory, so identically-named blocks in different groups keep their name.
 */
export function resolveComponents(
  components: Component[],
  segmentsByIndex: string[][],
): ResolvedComponent[] {
  const varNames = resolveVarNames(
    components.map((c) => c.name),
    componentVarName,
  );
  const fileNames = resolveFileNames(
    components.map((c) => componentFileName(c.name)),
    segmentsByIndex.map((segments) => segments.join("/")),
  );
  return components.map((component, i) => ({
    component,
    varName: varNames[i],
    fileName: fileNames[i],
    segments: segmentsByIndex[i],
  }));
}

/** Resolves each datasource to its unique variable and file names (flat layout). */
export function resolveDatasources(datasources: Datasource[]): ResolvedDatasource[] {
  const varNames = resolveVarNames(
    datasources.map((d) => d.name),
    datasourceVarName,
  );
  const fileNames = resolveFileNames(datasources.map((d) => datasourceFileName(d)));
  return datasources.map((datasource, i) => ({
    datasource,
    varName: varNames[i],
    fileName: fileNames[i],
  }));
}

/**
 * A remote component group paired with its unique `folders.ts` variable name
 * and the (slugified) directory-path segments it corresponds to.
 */
export interface ResolvedFolder {
  folder: ComponentFolder;
  varName: string;
  /** Slugified path segments (identity + directory mirror), parent-first. */
  segments: string[];
}

/**
 * Resolves remote component groups to unique `folders.ts` variable names, in
 * parent-first order (parents are declared, and thus referenceable, before
 * their children — required since `defineFolder({ parent })` is a value ref).
 */
export function resolveFolders(folders: ComponentFolder[]): ResolvedFolder[] {
  const pathByUuid = buildGroupPathByUuid(folders);
  const ordered = [...folders].sort(
    (a, b) => (pathByUuid.get(a.uuid)?.length ?? 0) - (pathByUuid.get(b.uuid)?.length ?? 0),
  );
  const varNames = resolveVarNames(
    ordered.map((f) => f.name),
    folderVarName,
  );
  return ordered.map((folder, i) => ({
    folder,
    varName: varNames[i],
    segments: pathByUuid.get(folder.uuid) ?? [],
  }));
}

/**
 * Builds the `schema init` group-whitelist resolver: a group uuid becomes the
 * bare `defineFolder` variable name its `folders.ts` declares, emitted verbatim
 * via {@link RawCode}.
 */
function rawCodeGroupResolver(
  folderVarByUuid?: Map<string, string>,
): ((uuid: string) => RawCode | undefined) | undefined {
  if (!folderVarByUuid) {
    return undefined;
  }
  return (uuid: string) => {
    const varName = folderVarByUuid.get(uuid);
    return varName === undefined ? undefined : new RawCode(varName);
  };
}

/**
 * Returns a shallow copy of `obj` without keys whose value is an empty array.
 * Remote blocks/fields carry many optional list fields the space never set
 * (e.g. `internal_tag_ids: []`, an empty `component_whitelist`); emitting them
 * as `key: []` is noise in a hand-editable definition, so they are dropped.
 */
function omitEmptyArrays(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value) && value.length === 0) {
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * Generates a `defineField('name', {...})` code string for a single schema field.
 * Position is implicit in the array index, so `pos` is stripped from the config.
 */
function generateFieldCode(
  fieldName: string,
  fieldData: Record<string, unknown>,
  depth: number,
  folderVarByUuid?: Map<string, string>,
): string {
  const clean = omitEmptyArrays(
    toDslField(stripKeys(fieldData, FIELD_STRIP_KEYS), rawCodeGroupResolver(folderVarByUuid)),
  );
  return `defineField(${quoteString(fieldName)}, ${formatValue(clean, depth)})`;
}

/**
 * Collects the sorted, unique `defineFolder` var names a component's fields
 * reference through fully-resolvable group whitelists, so the generated file can
 * import them.
 */
function collectWhitelistFolderVars(
  schema: Record<string, Record<string, unknown>>,
  folderVarByUuid?: Map<string, string>,
): string[] {
  const resolver = rawCodeGroupResolver(folderVarByUuid);
  const vars = new Set<string>();
  for (const field of Object.values(schema)) {
    if (!isRecord(field)) {
      continue;
    }
    // Mirrors `toDslField`: a disabled restriction emits no `allow`, so its
    // folders must not be imported either.
    if (field.restrict_components === false) {
      continue;
    }
    const refs = resolveGroupWhitelistEntries(field.component_group_whitelist, resolver);
    if (refs) {
      refs.forEach((ref) => vars.add(ref.code));
    }
  }
  return [...vars].sort();
}

/** Generates `folders.ts`: one `defineFolder` const per remote group, parents first. */
export function generateFoldersFile(resolved: ResolvedFolder[]): string {
  const varByUuid = new Map(resolved.map((r) => [r.folder.uuid, r.varName]));
  const lines: string[] = ["import { defineFolder } from '@storyblok/schema';", ""];
  for (const { folder, varName } of resolved) {
    const parentVar = folder.parent_uuid ? varByUuid.get(folder.parent_uuid) : undefined;
    lines.push(`export const ${varName} = defineFolder({`);
    lines.push(`${INDENT}name: ${quoteString(folder.name)},`);
    if (parentVar) {
      lines.push(`${INDENT}parent: ${parentVar},`);
    }
    lines.push("});");
    lines.push("");
  }
  return lines.join("\n");
}

/**
 * Generates a full TypeScript file for a component with `defineBlock()`.
 *
 * Strips API-assigned fields; schema fields become an ordered `fields:` array of
 * `defineField()` calls (sorted by `pos`). `component_group_uuid` is dropped —
 * groups are a UI concern and aren't part of a content-shape definition; when the
 * component belonged to a remote group, `folderRef` re-encodes it as an explicit
 * `folder: <folderVar>` reference (import path adjusted for its group depth).
 *
 * `folderVarByUuid` maps remote group uuids to their `folders.ts` var names so a
 * field's group whitelist is emitted as `allow: [<folderVar>]` (symmetric with a
 * block-name `allow`) instead of raw uuids; every referenced folder is imported
 * from the same `folders.ts` alongside the block's own folder ref.
 */
export function generateComponentFile(
  component: Component,
  varName?: string,
  folderRef?: { varName: string; segments: string[] },
  folderVarByUuid?: Map<string, string>,
): string {
  const lines: string[] = [];

  lines.push("import {");
  lines.push("  defineBlock,");
  lines.push("  defineField,");
  lines.push("} from '@storyblok/schema';");
  lines.push("");

  // A block sits at `blocks/<...group segments>/<name>.ts`; every folder var it
  // references lives in the root `folders.ts`, so all imports share one relative
  // path derived from the block's own group depth (0 when ungrouped).
  const blockDepth = folderRef?.segments.length ?? 0;
  const schema = isRecord(component.schema)
    ? (component.schema as Record<string, Record<string, unknown>>)
    : {};
  const folderVars = [
    ...new Set([
      ...(folderRef ? [folderRef.varName] : []),
      ...collectWhitelistFolderVars(schema, folderVarByUuid),
    ]),
  ].sort();
  if (folderVars.length > 0) {
    const rel = "../".repeat(blockDepth + 1);
    lines.push(`import { ${folderVars.join(", ")} } from '${rel}folders';`);
    lines.push("");
  }

  const resolvedVarName = varName ?? componentVarName(component.name);
  lines.push(`export const ${resolvedVarName} = defineBlock({`);

  const clean = omitEmptyArrays(
    stripKeys(component as unknown as Record<string, unknown>, COMPONENT_STRIP_KEYS),
  );

  // The group is encoded by the directory layout / folder ref, never emitted on the block.
  delete clean.component_group_uuid;

  // Enforce property order: name, display_name, is_root, is_nestable, folder, then rest, fields last
  const orderedKeys: string[] = [];
  if (clean.name !== undefined) {
    orderedKeys.push("name");
  }
  if (clean.display_name !== undefined) {
    orderedKeys.push("display_name");
  }
  if (clean.is_root !== undefined) {
    orderedKeys.push("is_root");
  }
  if (clean.is_nestable !== undefined) {
    orderedKeys.push("is_nestable");
  }

  const prefixKeyCount = orderedKeys.length;

  const handled = new Set(["name", "display_name", "is_root", "is_nestable", "schema"]);
  for (const key of Object.keys(clean).sort()) {
    if (!handled.has(key)) {
      orderedKeys.push(key);
    }
  }

  orderedKeys.forEach((key, i) => {
    lines.push(`${INDENT}${key}: ${formatValue(clean[key], 1)},`);
    // The folder ref is emitted right after the fixed name/display_name/is_root/
    // is_nestable block, regardless of which of those keys are actually present.
    if (folderRef && i === prefixKeyCount - 1) {
      lines.push(`${INDENT}folder: ${folderRef.varName},`);
    }
  });

  if (folderRef && prefixKeyCount === 0) {
    lines.push(`${INDENT}folder: ${folderRef.varName},`);
  }

  // Schema fields — emitted as an ordered `fields:` array of `defineField('name', {...})` calls.
  if (clean.schema && typeof clean.schema === "object") {
    const schema = clean.schema as Record<string, Record<string, unknown>>;
    const sortedFields = sortSchemaByPos(schema);

    if (sortedFields.length > 0) {
      lines.push(`${INDENT}fields: [`);
      for (const [fieldName, fieldData] of sortedFields) {
        const fieldCode = generateFieldCode(fieldName, fieldData, 2, folderVarByUuid);
        lines.push(`${INDENT}${INDENT}${fieldCode},`);
      }
      lines.push(`${INDENT}],`);
    } else {
      lines.push(`${INDENT}fields: [],`);
    }
  }

  lines.push("});");
  lines.push("");

  return lines.join("\n");
}

/**
 * Generates a full TypeScript file for a datasource with `defineDatasource()`.
 * Strips API-assigned fields (id, created_at, updated_at) and drops empty-array
 * fields the space never set (e.g. `dimensions: []`, which MAPI returns even
 * when unset) so they aren't emitted as noise in a hand-editable definition.
 */
export function generateDatasourceFile(datasource: Datasource, varName?: string): string {
  const lines: string[] = [];

  lines.push("import { defineDatasource } from '@storyblok/schema';");
  lines.push("");

  const resolvedVarName = varName ?? datasourceVarName(datasource.name);
  lines.push(`export const ${resolvedVarName} = defineDatasource({`);

  const clean = omitEmptyArrays(
    stripKeys(datasource as unknown as Record<string, unknown>, DATASOURCE_STRIP_KEYS),
  );

  // Enforce property order: name, slug, then rest
  if (clean.name !== undefined) {
    lines.push(`${INDENT}name: ${formatValue(clean.name, 1)},`);
  }
  if (clean.slug !== undefined) {
    lines.push(`${INDENT}slug: ${formatValue(clean.slug, 1)},`);
  }

  const handled = new Set(["name", "slug"]);
  for (const [key, value] of Object.entries(clean).sort(([a], [b]) => a.localeCompare(b))) {
    if (!handled.has(key)) {
      lines.push(`${INDENT}${key}: ${formatValue(value, 1)},`);
    }
  }

  lines.push("});");
  lines.push("");

  return lines.join("\n");
}

/**
 * Generates a `schema.ts` file that combines the schema object, types, and Story
 * alias. Blocks are imported from their group subdirectory (via each resolved
 * component's `segments`); the schema object exports `{ blocks, datasources,
 * folders }` — folders are only included when the space has remote groups.
 */
export function generateSchemaFile(
  components: ResolvedComponent[],
  datasources: ResolvedDatasource[],
  folders: ResolvedFolder[] = [],
): string {
  const lines: string[] = [];

  // Import the defineSchema helper and the Schema/Story type helpers
  lines.push("import { defineSchema } from '@storyblok/schema';");
  lines.push(
    "import type { Schema as InferSchema, Story as InferStory } from '@storyblok/schema';",
  );
  lines.push("import type { MapiStory as InferStoryMapi } from '@storyblok/schema';");
  lines.push("");

  // Import blocks from their (slugified) group subdirectory — local
  // organization that mirrors the remote groups; `schema push` ignores it.
  for (const { varName, fileName, segments } of components) {
    const subPath = segments.length > 0 ? `${segments.join("/")}/` : "";
    lines.push(`import { ${varName} } from './blocks/${subPath}${fileName}';`);
  }

  // Import datasources
  for (const { varName, fileName } of datasources) {
    lines.push(`import { ${varName} } from './datasources/${fileName}';`);
  }

  // Import folders (only when the space has remote groups)
  if (folders.length > 0) {
    lines.push(`import { ${folders.map((f) => f.varName).join(", ")} } from './folders';`);
  }

  lines.push("");

  // Export schema object
  lines.push("export const schema = defineSchema({");

  if (components.length > 0) {
    lines.push("  blocks: {");
    for (const { varName } of components) {
      lines.push(`    ${varName},`);
    }
    lines.push("  },");
  }

  if (datasources.length > 0) {
    lines.push("  datasources: {");
    for (const { varName } of datasources) {
      lines.push(`    ${varName},`);
    }
    lines.push("  },");
  }

  if (folders.length > 0) {
    lines.push("  folders: {");
    for (const { varName } of folders) {
      lines.push(`    ${varName},`);
    }
    lines.push("  },");
  }

  lines.push("});");
  lines.push("");

  // Schema and Blocks types derived via Schema helper
  lines.push("export type Schema = InferSchema<typeof schema>;");
  lines.push("export type Blocks = Schema['blocks'];");
  lines.push("export type Story = InferStory<Blocks>;");
  lines.push("export type StoryMapi = InferStoryMapi<Blocks>;");
  lines.push("");

  return lines.join("\n");
}
