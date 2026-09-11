import type { SchemaLike } from "./shapes";
import type { ValidationIssue, ValidationResult } from "./types";
import { DERIVED_RESTRICTION_KEYS, EDITOR_RESTRICT_TYPES } from "../restrictions";
import { isRecord, toValues } from "./shapes";

/**
 * Validates a schema definition without throwing. Checks structural identity
 * (missing or duplicate block names, field names, and datasource names and slugs) and cross-references
 * (every `allow` entry resolves to a defined block; every field `datasource`
 * resolves to a defined datasource; every `custom` field's `field_type`
 * resolves to a registered field plugin; no field mixes `allow`/`deny` with the
 * wire restriction keys they derive).
 *
 * @example
 * const result = validateSchema({ blocks: { hero }, datasources: { colors } });
 * if (!result.ok) console.error(result.issues);
 */
export function validateSchema(schema: SchemaLike): ValidationResult {
  const issues: ValidationIssue[] = [];
  const blocks = toValues(schema.blocks);
  const datasources = toValues(schema.datasources);
  const fieldPlugins = toValues(schema.fieldPlugins);

  const fieldPluginTypes = new Set<string>();
  for (const plugin of fieldPlugins) {
    const fieldType = plugin?.fieldType;
    if (typeof fieldType === "string") {
      fieldPluginTypes.add(fieldType);
    }
  }

  const datasourceSlugs = new Set<string>();
  // `schema push` diffs local against remote datasources by `name`, so a name is
  // an identity just like a slug: it has to exist, and it has to be unique.
  const datasourceNames = new Set<string>();
  for (let index = 0; index < datasources.length; index++) {
    const datasource = datasources[index];
    const slug = datasource?.slug;
    // A datasource without a usable slug has no identity: it cannot be pushed,
    // and no option field can reference it. Reported against `schema`, since
    // there is no slug to attribute the issue to.
    if (typeof slug !== "string" || slug.trim() === "") {
      issues.push({
        severity: "error",
        code: "invalid_datasource_slug",
        path: ["datasources", index],
        entity: "schema",
        message: `Datasource at index ${index} is missing a non-empty string "slug".`,
      });
      continue;
    }
    if (datasourceSlugs.has(slug)) {
      issues.push({
        severity: "error",
        code: "duplicate_datasource_slug",
        path: ["datasources", slug],
        entity: `datasource:${slug}`,
        message: `Duplicate datasource slug "${slug}".`,
      });
    }
    datasourceSlugs.add(slug);

    // Attributed to this datasource rather than to the one it collides with:
    // the second claimant is the one that has to be renamed.
    const name = datasource?.name;
    if (typeof name !== "string" || name.trim() === "") {
      issues.push({
        severity: "error",
        code: "invalid_datasource_name",
        path: ["datasources", slug, "name"],
        entity: `datasource:${slug}`,
        message: `Datasource "${slug}" is missing a non-empty string "name".`,
      });
      continue;
    }
    if (datasourceNames.has(name)) {
      issues.push({
        severity: "error",
        code: "duplicate_datasource_name",
        path: ["datasources", slug, "name"],
        entity: `datasource:${slug}`,
        message:
          `Duplicate datasource name "${name}" on datasource "${slug}". ` +
          `\`schema push\` matches datasources by name, so the two would collide.`,
      });
    }
    datasourceNames.add(name);
  }

  const blockNames = new Set<string>();
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    const name = block?.name;
    // A block without a usable name has no identity: it cannot be pushed, and no
    // `allow` entry can reference it. Reported against `schema`, since there is
    // no name to attribute the issue to — and so no consumer has to render an
    // entity heading for a nameless block.
    if (typeof name !== "string" || name.trim() === "") {
      issues.push({
        severity: "error",
        code: "invalid_block_name",
        path: ["blocks", index],
        entity: "schema",
        message: `Block at index ${index} is missing a non-empty string "name".`,
      });
      continue;
    }
    if (blockNames.has(name)) {
      issues.push({
        severity: "error",
        code: "duplicate_block_name",
        path: ["blocks", name],
        entity: `block:${name}`,
        message: `Duplicate block name "${name}".`,
      });
    }
    blockNames.add(name);
  }

  // Field-level checks run after the name/slug sets are fully populated so that
  // forward and circular references (resolved by name) validate correctly.
  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const block = blocks[blockIndex];
    const name = block?.name;
    const named = typeof name === "string" && name.trim() !== "";
    // A nameless block is already reported above; its fields are still checked,
    // but attributed to `schema` and located by index so no issue carries an
    // empty entity name or an empty path segment.
    const blockName = named ? name : "";
    const blockLabel = named ? `block "${blockName}"` : `the block at index ${blockIndex}`;
    const blockEntity = named ? `block:${blockName}` : "schema";
    const blockKey: string | number = named ? blockName : blockIndex;
    const fieldNames = new Set<string>();
    const fields = block?.fields ?? [];
    for (let index = 0; index < fields.length; index++) {
      const field = fields[index];
      // Flag malformed fields the wire mapper would otherwise silently drop:
      // a non-object entry, or one without a string `name` (its mapping key).
      if (!isRecord(field)) {
        issues.push({
          severity: "error",
          code: "invalid_field",
          path: ["blocks", blockKey, index],
          entity: blockEntity,
          message: `Field at index ${index} in ${blockLabel} is not an object.`,
        });
        continue;
      }
      const fieldName = field.name;
      if (typeof fieldName === "string") {
        if (fieldNames.has(fieldName)) {
          issues.push({
            severity: "error",
            code: "duplicate_field_name",
            path: ["blocks", blockKey, fieldName],
            entity: blockEntity,
            message: `Duplicate field name "${fieldName}" in ${blockLabel}.`,
          });
        }
        fieldNames.add(fieldName);
      } else {
        issues.push({
          severity: "error",
          code: "missing_field_name",
          path: ["blocks", blockKey, index],
          entity: blockEntity,
          message: `Field at index ${index} in ${blockLabel} is missing a string "name".`,
        });
      }

      for (const allowed of field.allow ?? []) {
        if (typeof allowed === "string" && !blockNames.has(allowed)) {
          issues.push({
            severity: "error",
            code: "unresolved_allow",
            path: ["blocks", blockKey, fieldName ?? index, "allow"],
            entity: blockEntity,
            message: `Field "${fieldName}" allows unknown block "${allowed}".`,
          });
        }
      }

      // A misspelled `deny` entry is worse than a misspelled `allow` one: the
      // allow list still restricts, so the mistake shows up as blocks going
      // missing from the picker, while a deny list that matches nothing silently
      // restricts nothing at all.
      for (const denied of field.deny ?? []) {
        if (typeof denied === "string" && !blockNames.has(denied)) {
          issues.push({
            severity: "error",
            code: "unresolved_deny",
            path: ["blocks", blockKey, fieldName ?? index, "deny"],
            entity: blockEntity,
            message: `Field "${fieldName}" denies unknown block "${denied}".`,
          });
        }
      }

      // `schema push` derives the wire restriction keys from `allow`/`deny` and
      // overwrites anything set by hand, so setting both silently drops one of
      // the two. `defineField` rejects this at compile time; repeat it here for
      // consumers authoring schemas in plain JavaScript.
      if (field.allow !== undefined || field.deny !== undefined) {
        for (const key of DERIVED_RESTRICTION_KEYS) {
          if (field[key] === undefined) {
            continue;
          }
          issues.push({
            severity: "error",
            code: "conflicting_restriction",
            path: ["blocks", blockKey, fieldName ?? index, key],
            entity: blockEntity,
            message: `Field "${fieldName}" sets "${key}" alongside "allow"/"deny", which derives it. Keep one of the two.`,
          });
        }
      }

      // `restrict_type` selects which restriction dimension the editor reads, and
      // it is the one restriction key the DSL tells authors to set by hand, for
      // the tag dimension. A typo silently unrestricts the field, so it is worth
      // flagging. A warning rather than an error: the API never validates this
      // key, so a space can legitimately hand back a value nothing recognizes,
      // and failing a build over what a space already stores would be wrong.
      const restrictType = field.restrict_type;
      if (typeof restrictType === "string" && !EDITOR_RESTRICT_TYPES.includes(restrictType)) {
        issues.push({
          severity: "warning",
          code: "unknown_restrict_type",
          path: ["blocks", blockKey, fieldName ?? index, "restrict_type"],
          entity: blockEntity,
          message: `Field "${fieldName}" sets "restrict_type" to "${restrictType}", which the editor does not recognize; the field's restriction lists are ignored. Expected one of ${EDITOR_RESTRICT_TYPES.map((value) => `"${value}"`).join(", ")}.`,
        });
      }

      const datasource = field.datasource;
      if (typeof datasource === "string" && !datasourceSlugs.has(datasource)) {
        issues.push({
          severity: "error",
          code: "unresolved_datasource",
          path: ["blocks", blockKey, fieldName ?? index, "datasource"],
          entity: blockEntity,
          message: `Field "${fieldName}" references unknown datasource "${datasource}".`,
        });
      }

      const fieldType = field.field_type;
      if (
        field.type === "custom" &&
        typeof fieldType === "string" &&
        !fieldPluginTypes.has(fieldType)
      ) {
        issues.push({
          severity: "error",
          code: "unresolved_field_plugin",
          path: ["blocks", blockKey, fieldName ?? index, "field_type"],
          entity: blockEntity,
          message: `Field "${fieldName}" references unregistered field plugin "${fieldType}".`,
        });
      }
    }
  }

  return { ok: issues.every((issue) => issue.severity !== "error"), issues };
}
