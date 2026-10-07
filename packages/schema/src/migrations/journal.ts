/**
 * Where a run's record lives. Undo replays the patches a run recorded, so they
 * need somewhere durable to sit.
 *
 * One interface, two kinds of record. A ledger entry is small, one per run, and
 * is what a listing prints. The inverse patches are proportional to the content
 * touched and are read only during an undo. They are separate methods rather
 * than separate interfaces because they share an id and a lifecycle: a run
 * writes both or neither, and splitting them would let a caller store one
 * without the other.
 *
 * No locking: two runs against the same space at the same time each record
 * their own entry, and neither is aware of the other.
 */
import type { BlockPatch } from "./patch";

/** Journal id for a run. Sorts chronologically, so a listing orders runs without reading them. */
export function runId(migration: string, at = new Date()): string {
  return `${at.toISOString().replace(/[:.]/g, "-")}-${migration}`;
}

export interface MigrationRun {
  /** The journal's own id for this run, not the migration's identity. */
  id: string;
  space: string;
  /** Filename-derived migration id, so a repeat run against a space is visible. */
  migration: string;
  title?: string;
  appliedAt: string;
  /** Stories the run changed. */
  stories: number;
  /** Blocks the run patched, across all stories. */
  blocks: number;
  /** When an undo restored every story the run changed; absent while any change is still in place. */
  undoneAt?: string;
}

/** A story's publish state as the run found it, before writing. */
export interface PublishState {
  published: boolean;
  unpublishedChanges: boolean;
}

/** The bulk half of a record: one story's inverse patches. */
export interface StoryInverse {
  story: number;
  patches: BlockPatch[];
  before: PublishState;
  /** The run published its write, so undoing it has to republish to restore the live version. */
  publishedByRun: boolean;
}

export interface Journal {
  /**
   * Writes both halves. Implementations write the patches before the entry: an
   * orphaned patch object is inert, whereas an entry pointing at patches that
   * were never stored is an undo that fails when it is needed. Recording a run
   * id again replaces both halves, so a caller can record a run before writing
   * and narrow it to the writes that landed afterwards.
   */
  record(run: MigrationRun, inverse: StoryInverse[]): Promise<void>;
  /** Deletes both halves; an unknown id is a no-op. */
  remove(id: string): Promise<void>;
  /** Metadata only — a listing must not have to pull patch bodies to print a table. */
  list(space: string): Promise<MigrationRun[]>;
  read(id: string): Promise<MigrationRun | undefined>;
  readInverse(id: string): Promise<StoryInverse[]>;
}
