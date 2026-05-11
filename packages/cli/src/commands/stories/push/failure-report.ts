import { APIError } from '../../../utils';
import type { UI } from '../../../utils/ui';

interface FailedStoryRecord {
  filename?: string;
  full_slug?: string;
  slug?: string;
  uuid?: string;
  id?: number | string;
  error: Error;
}

/**
 * Anything that carries a story's identity. Structural — accepts
 * `StoryIndexEntry`, MAPI `Story`, or an ad-hoc `{ filename }`.
 */
export interface StoryIdentity {
  filename?: string;
  full_slug?: string;
  slug?: string;
  uuid?: string;
  id?: number | string;
}

function formatStoryIdentifier(record: FailedStoryRecord): string {
  const title = record.full_slug ?? record.slug ?? record.uuid ?? record.id?.toString() ?? record.filename ?? 'unknown story';
  const extras: string[] = [];
  if (record.uuid && record.uuid !== title) { extras.push(`uuid: ${record.uuid}`); }
  if (record.filename && record.filename !== title) { extras.push(`file: ${record.filename}`); }
  return extras.length > 0 ? `${title} (${extras.join(', ')})` : title;
}

const ENRICHABLE_FIELDS = ['full_slug', 'slug', 'uuid', 'id', 'filename'] as const satisfies readonly (keyof FailedStoryRecord)[];

/**
 * Splice the record's value into field-level API error lines so users can see
 * which* value the server objected to. Example: `slug: is invalid` with
 * `record.slug === 'about#'` becomes `slug (about#): is invalid`.
 */
function enrichFieldMessage(detail: string, record: FailedStoryRecord): string {
  const match = detail.match(/^(\w+):/);
  if (!match) { return detail; }
  const field = match[1];
  if (!ENRICHABLE_FIELDS.includes(field as typeof ENRICHABLE_FIELDS[number])) { return detail; }
  const value = record[field as keyof FailedStoryRecord];
  if (value == null || value === '' || value instanceof Error) { return detail; }
  return `${field} (${String(value)})${detail.slice(field.length)}`;
}

function renderFailureReport(ui: UI, records: FailedStoryRecord[], verbose: boolean): void {
  if (records.length === 0) { return; }

  ui.error(`Failed stories (${records.length}):`, undefined, { header: false, margin: false });

  const lines: string[] = [];
  for (const record of records) {
    lines.push(formatStoryIdentifier(record));
    const messages = record.error instanceof APIError ? record.error.messageStack : [record.error.message];
    const [primary, ...rest] = messages;
    lines.push(`  • ${enrichFieldMessage(primary ?? 'Unknown error', record)}`);
    for (const detail of rest) {
      lines.push(`      └─ ${enrichFieldMessage(detail, record)}`);
    }
    if (verbose && record.error.stack) {
      for (const frame of record.error.stack.split('\n')) {
        lines.push(`      ${frame}`);
      }
    }
  }
  ui.list(lines);
  ui.br();
  if (!verbose) {
    ui.info('Re-run with the `--verbose` flag for full stack traces.', { margin: false });
  }
}

/**
 * Collects per-story failures across the push phases, dedups by identity on
 * insertion, and renders a grouped summary. The collector is phase-agnostic:
 * callers just ask `record()` "is this a new failure?" and decide their own
 * counter bookkeeping based on the answer.
 *
 * Identity key priority: `full_slug` → `uuid` → `filename` → synthetic.
 * `full_slug` is the only cross-phase-stable, in-space-unique identifier
 * (`uuid`/`id` are remapped by `storyRefMapper`, `slug` alone is not unique
 * because two stories can share a leaf slug under different parents).
 */
export class FailureCollector {
  private records = new Map<string, FailedStoryRecord>();

  private keyFor(story: StoryIdentity): string {
    return story.full_slug ?? story.uuid ?? story.filename ?? `__unknown_${this.records.size}`;
  }

  /**
   * Record a failure. Returns `true` if this is the first failure seen for
   * this story's identity, `false` if one was already recorded (in which case
   * the caller should skip counter updates to avoid double-billing).
   */
  record(story: StoryIdentity, error: Error): boolean {
    const key = this.keyFor(story);
    if (this.records.has(key)) { return false; }
    this.records.set(key, {
      filename: story.filename,
      full_slug: story.full_slug,
      slug: story.slug,
      uuid: story.uuid,
      id: story.id,
      error,
    });
    return true;
  }

  get isEmpty(): boolean {
    return this.records.size === 0;
  }

  get size(): number {
    return this.records.size;
  }

  render(ui: UI, verbose: boolean = false): void {
    renderFailureReport(ui, [...this.records.values()], verbose);
  }

  toReporterMeta(): Array<{
    filename: string | undefined;
    full_slug: string | undefined;
    slug: string | undefined;
    uuid: string | undefined;
    id: number | string | undefined;
    error: string;
  }> {
    return [...this.records.values()].map(r => ({
      filename: r.filename,
      full_slug: r.full_slug,
      slug: r.slug,
      uuid: r.uuid,
      id: r.id,
      error: r.error.message,
    }));
  }
}
