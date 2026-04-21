import { pipeline } from 'node:stream/promises';
import { Writable } from 'node:stream';
import type { Component } from '../components/constants';
import type { Story } from './constants';
import type { ComponentSchemas } from './ref-mapper';
import { walkRichtextBloks } from './richtext';
import { readLocalStoriesStream } from './streams';

export interface SchemaIssues {
  driftByComponent: Map<Component['name'], Set<string>>;
  missingSchemas: Set<Component['name']>;
}

/**
 * Aggregated schema-validation result across every local story in a directory.
 * Every drift field and missing component is paired with the set of affected
 * story `full_slug`s so the error message can point users at the files to fix.
 */
export interface AggregatedSchemaIssues {
  driftByComponent: Map<Component['name'], Map<string, Set<string>>>;
  missingSchemas: Map<Component['name'], Set<string>>;
  total: number;
}

const RESERVED_KEYS = new Set(['component']);
const isReservedKey = (key: string) => RESERVED_KEYS.has(key) || key.startsWith('_');

const MAX_STORIES_PER_ENTRY = 5;

const addDrift = (
  driftByComponent: Map<string, Set<string>>,
  component: string,
  field: string,
): void => {
  const existing = driftByComponent.get(component) ?? new Set<string>();
  existing.add(field);
  driftByComponent.set(component, existing);
};

/**
 * Validates a story's content against local component schemas without mutating
 * either input. Records two kinds of issues:
 *
 * - `missingSchemas`: the content references a component whose schema is not
 *   available locally. Descent into that subtree stops.
 * - `driftByComponent`: for each known component, the set of content fields
 *   the component's schema does not declare (schema drift).
 *
 * Descends into fields declared as `bloks` (array of bloks) and `richtext`
 * (traverses the AST, recursing into `type: 'blok'` nodes).
 */
export const validateStoryAgainstSchemas = (
  story: Story,
  schemas: ComponentSchemas,
): SchemaIssues => {
  const driftByComponent = new Map<string, Set<string>>();
  const missingSchemas = new Set<Component['name']>();

  const visit = (data: unknown): void => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) { return; }
    const node = data as Record<string, unknown>;
    const componentName = node.component;
    if (typeof componentName !== 'string' || componentName.length === 0) { return; }

    const schema = schemas[componentName];
    if (!schema) {
      missingSchemas.add(componentName);
      return;
    }

    for (const [fieldName, fieldValue] of Object.entries(node)) {
      if (isReservedKey(fieldName)) { continue; }

      const normalized = fieldName.replace(/__i18n__.*/, '');
      const fieldSchema = (schema as Record<string, unknown>)[normalized] as
        | Record<string, unknown>
        | undefined;

      if (!fieldSchema) {
        addDrift(driftByComponent, componentName, normalized);
        continue;
      }

      const fieldType = typeof fieldSchema.type === 'string' ? fieldSchema.type : undefined;

      if (fieldType === 'bloks' && Array.isArray(fieldValue)) {
        for (const item of fieldValue) { visit(item); }
      }
      else if (fieldType === 'richtext' && fieldValue && typeof fieldValue === 'object') {
        walkRichtextBloks(fieldValue, blok => visit(blok));
      }
    }
  };

  visit(story.content);

  return { driftByComponent, missingSchemas };
};

const addStoryToSet = (bag: Map<string, Set<string>>, key: string, storySlug: string): void => {
  const existing = bag.get(key) ?? new Set<string>();
  existing.add(storySlug);
  bag.set(key, existing);
};

/**
 * Streams every local story from `directoryPath` through
 * `validateStoryAgainstSchemas`, aggregating drift fields and missing component
 * schemas across the whole push and recording which stories are affected.
 * Resolves with an empty result when the directory does not exist — the
 * downstream pipeline reports that separately.
 */
export const collectSchemaIssues = async ({
  directoryPath,
  schemas,
}: {
  directoryPath: string;
  schemas: ComponentSchemas;
}): Promise<AggregatedSchemaIssues> => {
  const issues: AggregatedSchemaIssues = {
    driftByComponent: new Map(),
    missingSchemas: new Map(),
    total: 0,
  };

  try {
    await pipeline(
      readLocalStoriesStream({ directoryPath }),
      new Writable({
        objectMode: true,
        write(story: Story, _encoding, callback) {
          issues.total += 1;
          const storyIdentifier = story.full_slug || story.slug;
          const { driftByComponent, missingSchemas } = validateStoryAgainstSchemas(story, schemas);

          for (const component of missingSchemas) {
            addStoryToSet(issues.missingSchemas, component, storyIdentifier);
          }
          for (const [component, fields] of driftByComponent) {
            const fieldMap = issues.driftByComponent.get(component) ?? new Map<string, Set<string>>();
            for (const field of fields) { addStoryToSet(fieldMap, field, storyIdentifier); }
            issues.driftByComponent.set(component, fieldMap);
          }
          callback();
        },
      }),
    );
  }
  catch (error) {
    // Missing directory is surfaced by the downstream read stream during Pass 1;
    // pre-flight has nothing to add. Other errors propagate to the caller.
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') { throw error; }
  }

  return issues;
};

const formatStoryList = (stories: Set<string>): string => {
  const sorted = [...stories].sort();
  if (sorted.length <= MAX_STORIES_PER_ENTRY) { return sorted.join(', '); }
  const shown = sorted.slice(0, MAX_STORIES_PER_ENTRY).join(', ');
  return `${shown}, and ${sorted.length - MAX_STORIES_PER_ENTRY} more`;
};

/**
 * Builds the multi-line error message shown to the user when
 * `collectSchemaIssues` finds at least one problem. Splits the two kinds of
 * issues into separate sections with tailored remedies: the fix for a missing
 * component schema is different from the fix for an undeclared field, and
 * running `storyblok components pull` is not always the right answer.
 */
export const formatSchemaIssues = (issues: AggregatedSchemaIssues): string => {
  const lines: string[] = ['Schema validation failed. Push aborted.'];

  if (issues.missingSchemas.size > 0) {
    lines.push('');
    lines.push('Missing component schemas:');
    const sortedMissing = [...issues.missingSchemas.entries()]
      .sort(([a], [b]) => a.localeCompare(b));
    for (const [component, stories] of sortedMissing) {
      lines.push(`  - ${component} (in stories: ${formatStoryList(stories)})`);
    }
    lines.push('');
    lines.push('If these components exist in Storyblok, run `storyblok components pull` to sync them locally.');
    lines.push('Otherwise, create them in Storyblok first, or remove the references from the affected stories.');
  }

  if (issues.driftByComponent.size > 0) {
    lines.push('');
    lines.push('Fields not declared in local schemas:');
    const sortedComponents = [...issues.driftByComponent.entries()]
      .sort(([a], [b]) => a.localeCompare(b));
    for (const [component, fieldMap] of sortedComponents) {
      const sortedFields = [...fieldMap.entries()].sort(([a], [b]) => a.localeCompare(b));
      for (const [field, stories] of sortedFields) {
        lines.push(`  - ${component}.${field} (in stories: ${formatStoryList(stories)})`);
      }
    }
    lines.push('');
    lines.push('These fields will be lost when the stories are pushed. To fix, either:');
    lines.push('  - Add the field to the component in Storyblok, then run `storyblok components pull`');
    lines.push('  - Or remove the field from the affected story JSON files');
  }

  return lines.join('\n');
};

export const hasSchemaIssues = (issues: AggregatedSchemaIssues): boolean =>
  issues.missingSchemas.size > 0 || issues.driftByComponent.size > 0;
