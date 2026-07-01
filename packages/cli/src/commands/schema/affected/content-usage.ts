import { isRecord } from '../utils';

/** Usage of a single component within one story's content. */
export interface ComponentUsage {
  /** Number of blok instances of this component. */
  count: number;
  /** Impacted field name → number of instances where that field is present. */
  fields: Map<string, number>;
}

function recordBlok(
  blok: Record<string, unknown>,
  impacted: Map<string, Set<string>>,
  usage: Map<string, ComponentUsage>,
): void {
  const component = blok.component;
  if (typeof component !== 'string') {
    return;
  }
  const impactedFields = impacted.get(component);
  if (!impactedFields) {
    return;
  }

  let entry = usage.get(component);
  if (!entry) {
    entry = { count: 0, fields: new Map() };
    usage.set(component, entry);
  }
  entry.count += 1;

  for (const field of impactedFields) {
    if (field in blok) {
      entry.fields.set(field, (entry.fields.get(field) ?? 0) + 1);
    }
  }
}

/**
 * Walks a story's `content` and counts how often each impacted component (and
 * its impacted fields) appears, recursing through nested `bloks` fields and
 * richtext-embedded bloks. Any object carrying a string `component` key is
 * treated as a blok instance; the traversal is otherwise structure-agnostic so
 * it also reaches bloks nested inside richtext `attrs.body` arrays.
 *
 * @param content - The story's `content` object.
 * @param impacted - Map of impacted component name → impacted field names.
 * @returns Usage keyed by component name; components not in `impacted` are omitted.
 */
export function collectComponentUsage(
  content: unknown,
  impacted: Map<string, Set<string>>,
): Map<string, ComponentUsage> {
  const usage = new Map<string, ComponentUsage>();

  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item);
      }
      return;
    }
    if (isRecord(value)) {
      recordBlok(value, impacted, usage);
      for (const nested of Object.values(value)) {
        walk(nested);
      }
    }
  };

  walk(content);
  return usage;
}
