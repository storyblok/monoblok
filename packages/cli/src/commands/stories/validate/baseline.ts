import { FIELD_TYPES, type FieldType } from "@storyblok/schema";

import type { Component } from "../../../types";
import type { SchemaLike, ValidationIssue } from "../../../lib/validation";
import { isRecord } from "../../../utils/object";
import { mapBlockToWire } from "../../schema/map-to-wire";

/** Field-schema keys that are Storyblok sentinels, never user-defined fields. */
const SENTINEL_FIELDS = new Set(["_uid", "component"]);

/** A field in the shape the validators accept, keeping the remaining wire keys. */
interface WireField {
  name: string;
  type: FieldType;
  allow?: string[];
  [key: string]: unknown;
}

interface WireBlock {
  name: string;
  fields: WireField[];
}

function isKnownFieldType(value: unknown): value is FieldType {
  return FIELD_TYPES.some((fieldType) => fieldType === value);
}

function toField(name: string, definition: Record<string, unknown>): WireField | null {
  // The validators have no rule for a type outside the known field types.
  if (!isKnownFieldType(definition.type)) {
    return null;
  }

  const field: WireField = { ...definition, name, type: definition.type };

  // The validators read a block-name allow list from `allow`. The wire stores it
  // as `component_whitelist`, in force only with `restrict_components` on and the
  // block-name dimension selected.
  if (
    Array.isArray(definition.component_whitelist) &&
    definition.restrict_components === true &&
    !definition.restrict_type
  ) {
    field.allow = definition.component_whitelist.filter(
      (entry): entry is string => typeof entry === "string",
    );
  }

  return field;
}

function toBlocks(components: Component[]): WireBlock[] {
  return components.map((component) => ({
    name: component.name,
    fields: Object.entries(component.schema ?? {})
      .filter(([key]) => !SENTINEL_FIELDS.has(key))
      .map(([name, definition]) => (isRecord(definition) ? toField(name, definition) : null))
      .filter((field): field is WireField => field !== null),
  }));
}

export interface BaselineSchemas {
  /** The space's schema after `schema push <entry-file>`. */
  target: SchemaLike;
  /** The space's current schema. */
  baseline: SchemaLike;
}

/**
 * Builds the schemas a `--baseline` run compares. Both sides go through the
 * same wire conversion, so a block the push leaves unchanged validates the same
 * way on both. `schema push` without `--delete` keeps remote-only blocks, so the
 * target keeps them too.
 */
export function buildBaselineSchemas(
  local: { schema: SchemaLike; blockDefinitions: Record<string, unknown>[] },
  remoteComponents: Component[],
): BaselineSchemas {
  const localComponents = local.blockDefinitions.map(mapBlockToWire);
  const localNames = new Set(localComponents.map((component) => component.name));
  const remoteOnly = remoteComponents.filter((component) => !localNames.has(component.name));

  return {
    target: { ...local.schema, blocks: toBlocks([...localComponents, ...remoteOnly]) },
    baseline: { ...local.schema, blocks: toBlocks(remoteComponents) },
  };
}

function issueKey(issue: ValidationIssue): string {
  return JSON.stringify([issue.entity, issue.code, issue.path, issue.message]);
}

/** The issues in `target` that `baseline` does not report for the same story. */
export function introducedIssues(
  target: ValidationIssue[],
  baseline: ValidationIssue[],
): ValidationIssue[] {
  const existing = new Set(baseline.map(issueKey));
  return target.filter((issue) => !existing.has(issueKey(issue)));
}
