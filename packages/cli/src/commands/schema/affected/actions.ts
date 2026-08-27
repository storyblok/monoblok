import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { validateStory } from "@storyblok/schema";
import type { ValidationIssue } from "@storyblok/schema";

import type { Story } from "../../../types";
import { CommandError } from "../../../utils";
import type { DiffResult } from "../types";
import type { BreakingChange, ComponentBreakingChanges } from "../migrations/types";
import type { AdaptedSchema } from "../to-schema-like";
import {
  fetchStoriesStream,
  fetchStoryStream,
  readLocalStoriesStream,
} from "../../stories/streams";
import { ATTRIBUTED_ISSUE_CODES } from "./constants";
import { collectComponentUsage } from "./content-usage";

/** How an impacted component changed. `removed` = deleted from the local schema. */
export type ImpactAction = "update" | "removed";

/** A field-level change that affects existing content. */
export interface ImpactedField {
  /** Field name to report (the new name for renames). */
  field: string;
  /** Key present in existing (remote) content — the old name for renames. */
  contentKey: string;
  kind: BreakingChange["kind"];
}

/** An impacted component plus the field-level changes driving the impact. */
export interface ImpactedComponent {
  component: string;
  action: ImpactAction;
  fields: ImpactedField[];
}

export type ImpactedMap = Map<string, ImpactedComponent>;

/** A validation issue attributed to an impacted component (and optionally a field). */
export interface AttributedIssue {
  component: string;
  field?: string;
  severity: ValidationIssue["severity"];
  code: string;
  message: string;
}

/** An impacted field a story actually contains (drives per-field usage counts). */
export interface UsedField {
  component: string;
  field: string;
}

/** Per-story impact result. */
export interface AffectedStory {
  id: number;
  uuid: string;
  name: string;
  full_slug: string;
  /** Impacted components the story uses. */
  components: string[];
  /** Impacted fields the story actually contains. */
  usedFields: UsedField[];
  /** `true` when the change would newly produce a validation error in this story. */
  broken: boolean;
  issues: AttributedIssue[];
}

/** Per-field aggregate. */
export interface FieldImpact {
  field: string;
  kind: BreakingChange["kind"];
  used: number;
  broken: number;
}

/** Per-component aggregate. */
export interface ComponentImpact {
  component: string;
  action: ImpactAction;
  usedStories: number;
  brokenStories: number;
  fields: FieldImpact[];
}

/** The full impact report. */
export interface AffectedReport {
  space: string;
  components: ComponentImpact[];
  stories: AffectedStory[];
  totals: { usedStories: number; brokenStories: number; brokenComponents: number };
}

/** The content key a breaking change touches in existing content, and the reported field name. */
function toImpactedField(change: BreakingChange): ImpactedField {
  if (change.kind === "rename") {
    return { field: change.field, contentKey: change.oldField, kind: change.kind };
  }
  return { field: change.field, contentKey: change.field, kind: change.kind };
}

/**
 * Derives the set of impacted components from the schema diff and breaking-change
 * analysis. Updated components with breaking field changes are always impacted.
 * Removed (stale) components are impacted only when `withDelete` is set, because a
 * plain `schema push` leaves stale components in place — it only deletes them with
 * `--delete` — so their content would not break otherwise.
 */
export function computeImpactedComponents(
  diffResult: DiffResult,
  breakingChanges: ComponentBreakingChanges[],
  options: { withDelete?: boolean } = {},
): ImpactedMap {
  const impacted: ImpactedMap = new Map();

  for (const comp of breakingChanges) {
    impacted.set(comp.componentName, {
      component: comp.componentName,
      action: "update",
      fields: comp.changes.map(toImpactedField),
    });
  }

  if (options.withDelete) {
    for (const diff of diffResult.diffs) {
      if (diff.type === "component" && diff.action === "stale") {
        impacted.set(diff.name, { component: diff.name, action: "removed", fields: [] });
      }
    }
  }

  return impacted;
}

/** Maps each impacted component to the content keys its impacted fields occupy. */
function toContentKeyMap(impacted: ImpactedMap): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const [component, entry] of impacted) {
    map.set(component, new Set(entry.fields.map((field) => field.contentKey)));
  }
  return map;
}

/** Everything `analyzeStory` needs, computed once per run rather than per story. */
export interface AnalyzeContext {
  impacted: ImpactedMap;
  contentKeyMap: Map<string, Set<string>>;
  oldSchema: AdaptedSchema;
  newSchema: AdaptedSchema;
}

/** Builds the shared analysis context (hoists the per-component content-key map). */
export function createAnalyzeContext(
  impacted: ImpactedMap,
  oldSchema: AdaptedSchema,
  newSchema: AdaptedSchema,
): AnalyzeContext {
  return { impacted, contentKeyMap: toContentKeyMap(impacted), oldSchema, newSchema };
}

/** Stable identity for a validation issue, used to diff old vs. new schema results. */
function issueKey(issue: ValidationIssue): string {
  return `${issue.entity}|${issue.code}|${issue.path.join(".")}`;
}

/**
 * Finds the impacted field an issue points at. An issue path runs from the story
 * root down to the offending value (`content` › `body` › 0 › `title`), so it is
 * walked from the end: the deepest matching segment is the field that actually
 * failed, not the parent field that happens to contain it. The leading `content`
 * segment is skipped so a field literally named `content` cannot match every
 * issue.
 */
function matchField(entry: ImpactedComponent, issuePath: (string | number)[]): string | undefined {
  const names = new Map<string, string>();
  for (const field of entry.fields) {
    // Renames validate at the new name but occupy the old content key, so match either.
    names.set(field.contentKey, field.field);
    names.set(field.field, field.field);
  }

  for (let index = issuePath.length - 1; index > 0; index -= 1) {
    const segment = issuePath[index];
    if (typeof segment !== "string") {
      continue;
    }
    const match = names.get(segment);
    if (match) {
      return match;
    }
  }
  return undefined;
}

/**
 * Analyzes one story: which impacted components/fields it uses and whether the
 * change would newly break it. Breakage is diffed against the old (remote) schema
 * so pre-existing invalid content is not misattributed to the analyzed change.
 */
export function analyzeStory(story: Story, ctx: AnalyzeContext): AffectedStory | null {
  const usage = collectComponentUsage(story.content, ctx.contentKeyMap);
  if (usage.size === 0) {
    return null;
  }

  const issues: AttributedIssue[] = [];
  const usedFields: UsedField[] = [];
  let broken = false;

  // Per-field usage: an impacted field is "used" when its content key is present.
  for (const [component, entry] of ctx.impacted) {
    const componentUsage = usage.get(component);
    if (!componentUsage) {
      continue;
    }
    for (const field of entry.fields) {
      if (componentUsage.fields.has(field.contentKey)) {
        usedFields.push({ component, field: field.field });
      }
    }
  }

  // Removed components are absent from the new schema, so every story using one
  // breaks once the deletion is pushed. `validateStory` reports these against the
  // `story` entity (not `block:<name>`), so surface them explicitly here.
  for (const component of usage.keys()) {
    const entry = ctx.impacted.get(component);
    if (entry?.action === "removed") {
      broken = true;
      issues.push({
        component,
        severity: "error",
        code: "component_removed",
        message: `Component "${component}" is removed from the schema; its content becomes out-of-schema.`,
      });
    }
  }

  // Only errors the change introduces count: subtract issues already present when
  // validating the story against the old schema.
  const preExisting = new Set(validateStory(story, ctx.oldSchema).issues.map(issueKey));
  const { issues: validationIssues } = validateStory(story, ctx.newSchema);
  for (const issue of validationIssues) {
    if (!issue.entity.startsWith("block:") || preExisting.has(issueKey(issue))) {
      continue;
    }
    if (!ATTRIBUTED_ISSUE_CODES.has(issue.code)) {
      continue;
    }
    const component = issue.entity.slice("block:".length);
    const entry = ctx.impacted.get(component);
    if (!entry || !usage.has(component)) {
      continue;
    }
    if (issue.severity === "error") {
      broken = true;
    }
    issues.push({
      component,
      field: matchField(entry, issue.path),
      severity: issue.severity,
      code: issue.code,
      message: issue.message,
    });
  }

  return {
    id: story.id,
    uuid: story.uuid ?? "",
    name: story.name ?? "",
    full_slug: story.full_slug ?? "",
    components: [...usage.keys()],
    usedFields,
    broken,
    issues,
  };
}

/** Aggregates per-story results into per-component and per-field impact totals. */
export function aggregate(
  space: string,
  impacted: ImpactedMap,
  stories: AffectedStory[],
): AffectedReport {
  const components: ComponentImpact[] = [];

  for (const [component, entry] of impacted) {
    const used = stories.filter((story) => story.components.includes(component));
    const broken = used.filter((story) =>
      story.issues.some((issue) => issue.component === component && issue.severity === "error"),
    );

    const fields: FieldImpact[] = entry.fields.map((field) => {
      const usedCount = used.filter((story) =>
        story.usedFields.some(
          (usedField) => usedField.component === component && usedField.field === field.field,
        ),
      ).length;
      const brokenCount = broken.filter((story) =>
        story.issues.some(
          (issue) =>
            issue.component === component &&
            issue.field === field.field &&
            issue.severity === "error",
        ),
      ).length;
      return { field: field.field, kind: field.kind, used: usedCount, broken: brokenCount };
    });

    components.push({
      component,
      action: entry.action,
      usedStories: used.length,
      brokenStories: broken.length,
      fields,
    });
  }

  return {
    space,
    components,
    stories,
    totals: {
      usedStories: stories.length,
      brokenStories: stories.filter((story) => story.broken).length,
      brokenComponents: components.filter((component) => component.brokenStories > 0).length,
    },
  };
}

/** Progress and error callbacks shared by the remote and local analyzers. */
export interface AnalyzeHooks {
  onTotal?: (total: number) => void;
  onStory?: () => void;
  onStoryError?: (error: Error, storyRef?: string) => void;
}

/** A pipeline sink that analyzes each story and collects any impact into `results`. */
function createAnalyzeCollector(ctx: AnalyzeContext, results: AffectedStory[]): Writable {
  return new Writable({
    objectMode: true,
    write(story: Story, _encoding, callback) {
      const result = analyzeStory(story, ctx);
      if (result) {
        results.push(result);
      }
      callback();
    },
  });
}

/**
 * Fetches remote stories that use any impacted component, fetches full content
 * per story, and analyzes each.
 *
 * `contain_component` matches a component anywhere in a story's content, root
 * content type included. It has AND (superset) semantics for a comma-separated
 * list, so one request per impacted component is issued and their results
 * unioned by story id. Over-fetching is harmless: `analyzeStory` recomputes
 * usage from the story's own content.
 *
 * A listing that fails part-way is fatal. Silently analyzing a truncated set
 * would report a smaller impact than the real one, and under `--fail-on-break`
 * that is a false all-clear on a CI gate.
 */
export async function analyzeRemoteStories(
  spaceId: string,
  impacted: ImpactedMap,
  oldSchema: AdaptedSchema,
  newSchema: AdaptedSchema,
  hooks: AnalyzeHooks = {},
): Promise<AffectedStory[]> {
  const ctx = createAnalyzeContext(impacted, oldSchema, newSchema);
  const results: AffectedStory[] = [];

  const storyIds = new Set<number>();
  for (const component of impacted.keys()) {
    let listError: Error | undefined;
    const listStream = fetchStoriesStream({
      spaceId,
      params: { contain_component: component, story_only: true },
      onPageError: (error) => {
        listError = error;
      },
    });
    for await (const story of listStream) {
      storyIds.add(story.id);
    }
    if (listError) {
      throw new CommandError(
        `Could not list the stories using "${component}": ${listError.message}. The analysis would be incomplete, so no result is reported.`,
      );
    }
  }

  hooks.onTotal?.(storyIds.size);

  const fetchStream = fetchStoryStream({
    spaceId,
    // Increment per attempted story (success or failure) so progress reaches 100%.
    onIncrement: hooks.onStory,
    onStoryError: (error, story) => hooks.onStoryError?.(error, String(story.id)),
  });

  await pipeline(
    Readable.from([...storyIds].map((id) => ({ id }))),
    fetchStream,
    createAnalyzeCollector(ctx, results),
  );
  return results;
}

/** Reads local story JSON files and analyzes each against the impacted set. */
export async function analyzeLocalStories(
  directoryPath: string,
  impacted: ImpactedMap,
  oldSchema: AdaptedSchema,
  newSchema: AdaptedSchema,
  hooks: AnalyzeHooks = {},
): Promise<AffectedStory[]> {
  const ctx = createAnalyzeContext(impacted, oldSchema, newSchema);
  const results: AffectedStory[] = [];

  const localStream = readLocalStoriesStream({
    directoryPath,
    setTotalStories: hooks.onTotal,
    onIncrement: hooks.onStory,
    onStoryError: (error, filename) => hooks.onStoryError?.(error, filename),
  });

  await pipeline(localStream, createAnalyzeCollector(ctx, results));
  return results;
}
