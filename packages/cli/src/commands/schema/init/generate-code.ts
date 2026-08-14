import type { Component, ComponentFolder, Datasource } from "../../../types";
import { slugify } from "../../../utils/format";
import { buildGroupPathByUuid } from "../folders";
import {
  COMPONENT_STRIP_KEYS,
  DATASOURCE_STRIP_KEYS,
  formatValue,
  INDENT,
  isRecord,
  quoteString,
  RawCode,
  stripKeys,
} from "../utils";

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

/**
 * Converts a string to kebab-case, keeping only filesystem/shell-safe
 * characters. Handles snake_case, camelCase, PascalCase, and space-separated
 * words; any remaining non-`[a-z0-9-]` characters collapse to a single `-`.
 */
function toKebabCase(str: string): string {
  return str
    .replace(/[\s_]+/g, "-")
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
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

/**
 * Resolves an ordered list of raw names to unique variable names. Names that
 * sanitize to the same identifier get a numeric suffix (`…2`, `…3`), so the
 * generated `export const`s and schema-object keys never collide. Index-aligned
 * to `rawNames`.
 */
export function resolveVarNames(
  rawNames: string[],
  baseVarName: (name: string) => string,
): string[] {
  const used = new Set<string>();
  return rawNames.map((raw) => {
    const base = baseVarName(raw);
    let candidate = base;
    let n = 2;
    while (used.has(candidate)) {
      candidate = `${base}${n++}`;
    }
    used.add(candidate);
    return candidate;
  });
}

/**
 * Resolves an ordered list of already-sanitized base file names to unique ones.
 * `toKebabCase` is lossy (it collapses `_`/`-` runs and strips symbols), so two
 * distinct source names can produce the same file name even though the raw names
 * are unique. Collisions get a `-2`, `-3`, … suffix so generated files never
 * overwrite each other and each `schema.ts` import resolves unambiguously.
 *
 * `dirKeys` scopes uniqueness per directory: blocks live in their group
 * subdirectory, so two blocks with the same file name in *different* group
 * directories don't collide on disk and must keep their shared name. Pass the
 * containing directory (e.g. the joined group path) per index; omit for a flat
 * layout (datasources). Index-aligned to `baseNames`.
 */
export function resolveFileNames(baseNames: string[], dirKeys?: string[]): string[] {
  const usedByDir = new Map<string, Set<string>>();
  return baseNames.map((base, i) => {
    const dir = dirKeys?.[i] ?? "";
    let used = usedByDir.get(dir);
    if (!used) {
      used = new Set<string>();
      usedByDir.set(dir, used);
    }
    let candidate = base;
    let n = 2;
    while (used.has(candidate)) {
      candidate = `${base}-${n++}`;
    }
    used.add(candidate);
    return candidate;
  });
}

/** Returns the file name (without extension) for a component. e.g. `'teaser_list'` -> `'teaser-list'` */
export function componentFileName(name: string): string {
  return toKebabCase(name);
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
 * Resolves a field's group list uuids to `defineFolder` ref identifiers when
 * every uuid maps to a known folder var, returning the ordered {@link RawCode}
 * refs. Returns `undefined` when there is nothing to resolve or any uuid is
 * unknown, so the caller keeps the raw wire form (still round-trips via the
 * diff's uuid↔path translation) rather than emitting a broken ref.
 */
function resolveGroupRefs(
  groupList: unknown,
  folderVarByUuid?: Map<string, string>,
): RawCode[] | undefined {
  if (!folderVarByUuid || !Array.isArray(groupList) || groupList.length === 0) {
    return undefined;
  }
  const vars = groupList.map((uuid) =>
    typeof uuid === "string" ? folderVarByUuid.get(uuid) : undefined,
  );
  if (!vars.every((v): v is string => typeof v === "string")) {
    return undefined;
  }
  return vars.map((v) => new RawCode(v));
}

/** Whether a wire restriction list holds entries (an absent or empty list is no restriction). */
function isNonEmptyList(list: unknown): boolean {
  return Array.isArray(list) && list.length > 0;
}

/**
 * How a field's wire restriction keys map back to the DSL, resolved once so
 * {@link toDslField} and {@link collectRestrictionFolderVars} can never disagree
 * about whether a field's folder refs are emitted (and therefore imported).
 *
 * - `disabled` — `restrict_components: false`: the flag round-trips, the lists do not.
 * - `tags` — restricted by block tag: the tag lists and their flags keep their wire form.
 * - `names` — restricted by block name: `allow`/`deny` hold plain names.
 * - `folders` — restricted by folder, every uuid resolved to a `defineFolder` ref.
 * - `raw` — restricted by folder, but at least one uuid is unknown: keep the wire keys.
 * - `none` — no restriction in force.
 */
type FieldRestriction =
  | { kind: "disabled" }
  | { kind: "tags" }
  | { kind: "names"; allow?: unknown; deny?: unknown }
  | { kind: "folders"; allow?: RawCode[]; deny?: RawCode[] }
  | { kind: "raw" }
  | { kind: "none" };

/**
 * The field types that own the component restriction keys (`restrict_components`,
 * `restrict_type` and the group lists).
 *
 * A space can store those keys on any field type — the Management API takes a
 * component schema as an opaque blob and stores a stray `restrict_components: true`
 * on an `asset` field verbatim (verified against the API) — but the editor only
 * reads them on these two, and `defineField` rejects an option the field type does
 * not own. Emitting such a stray key would generate code that does not compile, so
 * the restriction keys are only ever emitted for these types.
 */
const RESTRICTABLE_FIELD_TYPES = new Set(["bloks", "richtext"]);

/**
 * Classifies a field's wire restriction keys. The block-name and folder
 * dimensions are mutually exclusive in the editor, which clears one dimension's
 * lists when you switch to the other, so a field restricted by folder carries an
 * empty `component_whitelist: []` alongside its group list. Non-emptiness is
 * therefore what picks the dimension.
 *
 * When both dimensions somehow hold a list, block names win here while the editor
 * would evaluate the folder list and ignore the names. The orders disagree on
 * purpose: whichever one loses gets dropped from the emitted DSL, and dropping a
 * name list is the more visible loss. Neither reading is faithful, so the shape is
 * a round-trip hazard either way. The editor cannot author it (switching dimension
 * clears all six lists) and the Management API only backstops that for `bloks`
 * fields, so reaching it takes a `richtext` written through the API.
 *
 * Within a dimension the editor offers allow or block, never both, so a field
 * whose allow and deny lists are both non-empty is legacy or API-written as well.
 * Both are kept: `defineField` accepts the pair, and dropping either would change
 * what the space allows.
 *
 * The tag dimension needs `restrict_type: 'tags'` and a non-empty tag list. The
 * `restrict_type` check alone is not enough to claim the field, because a list the
 * editor cannot produce still has to be handled: switching dimension in the editor
 * clears all six lists, and the Management API only backstops that for `bloks`
 * fields (it strips the name lists, keeping the group ones), so on `richtext` a
 * legacy or API-written `restrict_type: 'tags'` can survive next to a live
 * `component_whitelist`. Claiming that field for the tag dimension would drop the
 * name list on the round trip.
 *
 * A `restrict_type: 'tags'` that no tag list backs still never falls through to
 * `none`: it ends up in `raw`, which keeps `restrict_type` and
 * `restrict_components` verbatim. `restrict_type: 'tags'` with both lists empty
 * still restricts by tags in the editor, and dropping the two flags would leave
 * nothing to re-derive them from, silently unrestricting the field on the next
 * push.
 */
function resolveFieldRestriction(
  field: Record<string, unknown>,
  folderVarByUuid?: Map<string, string>,
): FieldRestriction {
  if (field.restrict_components === false) {
    return { kind: "disabled" };
  }
  if (
    field.restrict_type === "tags" &&
    (isNonEmptyList(field.component_tag_whitelist) || isNonEmptyList(field.component_tag_denylist))
  ) {
    return { kind: "tags" };
  }
  const hasNameAllow = isNonEmptyList(field.component_whitelist);
  const hasNameDeny = isNonEmptyList(field.component_denylist);
  if (hasNameAllow || hasNameDeny) {
    return {
      kind: "names",
      allow: hasNameAllow ? field.component_whitelist : undefined,
      deny: hasNameDeny ? field.component_denylist : undefined,
    };
  }
  const hasGroupAllow = isNonEmptyList(field.component_group_whitelist);
  const hasGroupDeny = isNonEmptyList(field.component_group_denylist);
  if (hasGroupAllow || hasGroupDeny) {
    const allow = hasGroupAllow
      ? resolveGroupRefs(field.component_group_whitelist, folderVarByUuid)
      : undefined;
    const deny = hasGroupDeny
      ? resolveGroupRefs(field.component_group_denylist, folderVarByUuid)
      : undefined;
    // Partial resolution is not good enough: emitting the resolvable list as DSL
    // refs while dropping the other would lose a restriction that is in force.
    return (!hasGroupAllow || allow) && (!hasGroupDeny || deny)
      ? { kind: "folders", allow, deny }
      : { kind: "raw" };
  }
  if (
    field.restrict_type === "tags" ||
    field.component_group_whitelist !== undefined ||
    field.component_group_denylist !== undefined
  ) {
    return { kind: "raw" };
  }
  return { kind: "none" };
}

/**
 * Reverse of the push-time DSL→wire field mapping: renames the wire reference
 * keys back to their DSL form (`component_whitelist`/`component_group_whitelist`
 * → `allow`, `component_denylist`/`component_group_denylist` → `deny`, either as
 * plain block names or as `defineFolder` refs, and `datasource_slug` →
 * `datasource`). The `source` selector is left untouched.
 *
 * `restrict_components: true` and `restrict_type` are dropped alongside a
 * resolved `allow`/`deny` — they're the wire byproduct `defineField` re-derives on
 * push, not independent DSL state. Group lists that cannot be fully resolved to
 * folder refs keep their raw wire form.
 *
 * `restrict_components: false` disables the restriction while the space may still
 * store stale lists. Emitting an inactive list as `allow`/`deny` would make
 * `schema push` re-derive `restrict_components: true` and silently switch the
 * restriction back on, changing what editors may insert. So a disabled
 * restriction keeps its flag and drops the lists: the flag round-trips
 * losslessly, at the cost of discarding lists that are not in force anyway.
 *
 * An absent `restrict_components` counts as active, which is a deliberate
 * narrowing rather than a faithful read. The editor treats the flag's absence as
 * "no restriction at all", so a legacy field carrying a bare `component_whitelist`
 * accepts anything today. Emitting it as `allow` makes push re-derive
 * `restrict_components: true`, and the restriction starts being enforced. That
 * matches the list's apparent intent, and the alternative is discarding a list
 * someone wrote on purpose, but it does change what editors may insert.
 *
 * A tag restriction (`restrict_type: 'tags'` with a tag list in force) keeps its
 * wire form, flags included: the tag dimension has no `allow`/`deny` equivalent,
 * so dropping `restrict_type` would leave the tag lists inert on the next push,
 * and emitting the field's (stale, not-in-force) name or group lists as DSL refs
 * would switch it back to restricting by name.
 *
 * `restrict_components: true` with no list in force is kept too, for the same
 * reason: with no `allow`/`deny` emitted there is nothing to re-derive it from, so
 * dropping it switched the restriction off on the next push.
 *
 * None of these flags are emitted for a field type that does not own them; see
 * {@link RESTRICTABLE_FIELD_TYPES}.
 *
 * See {@link resolveFieldRestriction} for how the block-name and folder
 * dimensions are told apart.
 */
function toDslField(
  field: Record<string, unknown>,
  folderVarByUuid?: Map<string, string>,
): Record<string, unknown> {
  const {
    component_whitelist,
    component_denylist,
    component_group_whitelist,
    component_group_denylist,
    component_tag_whitelist,
    component_tag_denylist,
    datasource_slug,
    restrict_components,
    restrict_type,
    ...rest
  } = field;
  const out: Record<string, unknown> = { ...rest };
  const restriction = resolveFieldRestriction(field, folderVarByUuid);
  // Stray restriction keys on a field type that does not own them are junk the
  // editor never wrote and never reads; emitting them would not compile.
  const restrictable = RESTRICTABLE_FIELD_TYPES.has(field.type as string);

  // The tag lists have no DSL equivalent, so they pass through verbatim whenever
  // the field type owns them, whichever dimension is actually in force.
  if (restrictable) {
    if (component_tag_whitelist !== undefined) {
      out.component_tag_whitelist = component_tag_whitelist;
    }
    if (component_tag_denylist !== undefined) {
      out.component_tag_denylist = component_tag_denylist;
    }
  }

  switch (restriction.kind) {
    case "disabled":
      if (restrictable) {
        out.restrict_components = false;
        if (restrict_type !== undefined) {
          out.restrict_type = restrict_type;
        }
      }
      break;
    case "tags":
      if (restrictable) {
        if (restrict_components !== undefined) {
          out.restrict_components = restrict_components;
        }
        out.restrict_type = restrict_type;
      }
      break;
    case "names":
    case "folders":
      if (restriction.allow !== undefined) {
        out.allow = restriction.allow;
      }
      if (restriction.deny !== undefined) {
        out.deny = restriction.deny;
      }
      break;
    case "raw":
      if (restrictable) {
        if (component_group_whitelist !== undefined) {
          out.component_group_whitelist = component_group_whitelist;
        }
        if (component_group_denylist !== undefined) {
          out.component_group_denylist = component_group_denylist;
        }
        if (restrict_components !== undefined) {
          out.restrict_components = restrict_components;
        }
        if (restrict_type !== undefined) {
          out.restrict_type = restrict_type;
        }
      }
      break;
    case "none":
      // No list is in force, so there is no `allow`/`deny` here to re-derive the
      // flags from on the next push. `restrict_components: true` is still real
      // state — the editor restriction is switched on with nothing selected — and
      // dropping it silently unrestricted the field on the round-trip, so it is
      // kept along with the dimension selector it applies to. An absent flag has
      // nothing to preserve, and `false` is classified as `disabled` instead.
      if (restrictable && restrict_components === true) {
        out.restrict_components = restrict_components;
        if (restrict_type !== undefined) {
          out.restrict_type = restrict_type;
        }
      }
      break;
  }
  if (datasource_slug !== undefined) {
    out.datasource = datasource_slug;
  }
  return out;
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
    toDslField(stripKeys(fieldData, FIELD_STRIP_KEYS), folderVarByUuid),
  );
  return `defineField(${quoteString(fieldName)}, ${formatValue(clean, depth)})`;
}

/**
 * Collects the sorted, unique `defineFolder` var names a component's fields
 * reference through fully-resolvable group lists, so the generated file can
 * import them. Shares {@link resolveFieldRestriction} with {@link toDslField} so
 * only folders that actually reach the emitted `allow`/`deny` are imported.
 */
function collectRestrictionFolderVars(
  schema: Record<string, Record<string, unknown>>,
  folderVarByUuid?: Map<string, string>,
): string[] {
  const vars = new Set<string>();
  for (const field of Object.values(schema)) {
    if (!isRecord(field)) {
      continue;
    }
    const restriction = resolveFieldRestriction(field, folderVarByUuid);
    if (restriction.kind !== "folders") {
      continue;
    }
    for (const ref of [...(restriction.allow ?? []), ...(restriction.deny ?? [])]) {
      vars.add(ref.code);
    }
  }
  return [...vars].sort();
}

/** Sorts schema fields by `pos` for stable ordering. */
function sortSchemaByPos(
  schema: Record<string, Record<string, unknown>>,
): [string, Record<string, unknown>][] {
  return Object.entries(schema)
    .filter(([key]) => key !== "_uid" && key !== "component")
    .sort(([, a], [, b]) => {
      const posA = typeof a.pos === "number" ? a.pos : Infinity;
      const posB = typeof b.pos === "number" ? b.pos : Infinity;
      return posA - posB;
    });
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
      ...collectRestrictionFolderVars(schema, folderVarByUuid),
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
  // `BlockContent` only backs the block helpers below, which a space with no
  // components does not get. Importing it regardless trips `noUnusedLocals`.
  lines.push(
    components.length > 0
      ? "import type { BlockContent, MapiStory as InferStoryMapi } from '@storyblok/schema';"
      : "import type { MapiStory as InferStoryMapi } from '@storyblok/schema';",
  );
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

  // Schema and Blocks types derived via Schema helper. `FieldPlugins` is
  // threaded through the story types so registering a field plugin later is a
  // one-line change; with none registered it resolves to an empty map and costs
  // nothing.
  lines.push("export type Schema = InferSchema<typeof schema>;");
  lines.push("export type Blocks = Schema['blocks'];");
  lines.push("export type FieldPlugins = Schema['fieldPlugins'];");
  lines.push("export type Story = InferStory<Blocks, FieldPlugins>;");
  lines.push("export type StoryMapi = InferStoryMapi<Blocks, FieldPlugins>;");

  if (components.length > 0) {
    lines.push("");
    lines.push('// Type a component\'s props by block name: `Block<"hero">`.');
    lines.push("export type Block<TName extends Blocks['name']> = BlockContent<");
    lines.push("  Extract<Blocks, { name: TName }>,");
    lines.push("  Blocks,");
    lines.push("  FieldPlugins");
    lines.push(">;");
    lines.push("");
    lines.push("// Loose union of every block's content, for a dynamic component dispatcher.");
    lines.push("export type AnyBlock = BlockContent<Blocks, Blocks, FieldPlugins>;");
  }

  lines.push("");

  return lines.join("\n");
}
