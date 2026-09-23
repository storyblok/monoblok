/**
 * SPIKE — prototype quality. Not a shipped API.
 *
 * Where a run's record lives. Rollback's first and only trustworthy tier is the
 * patches the run recorded, so those patches need somewhere durable to sit —
 * which also makes this the place that answers "has this migration already run
 * against this space?", a question that is wrong to answer per-machine.
 *
 * One interface, two kinds of record. A ledger entry is small, one per run, and
 * is what a listing prints. The inverse patches are proportional to the content
 * touched and are read only during a rollback. They are separate methods rather
 * than separate interfaces because they share an id and a lifecycle: a run
 * writes both or neither, and splitting them would let a caller store one
 * without the other.
 *
 * No locking. See "Concurrent runs" in the README.
 */
import type { BlockPatch } from "./patch";

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
}

/** The bulk half of a record: one story's inverse patches. */
export interface StoryInverse {
  story: string;
  patches: BlockPatch[];
}

export interface Journal {
  /**
   * Writes both halves. Implementations write the patches before the entry: an
   * orphaned patch object is inert, whereas an entry pointing at patches that
   * were never stored is a rollback that fails when it is needed.
   */
  record(run: MigrationRun, inverse: StoryInverse[]): Promise<void>;
  /** Metadata only — a listing must not have to pull patch bodies to print a table. */
  list(space: string): Promise<MigrationRun[]>;
  read(id: string): Promise<MigrationRun | undefined>;
  readInverse(id: string): Promise<StoryInverse[]>;
}
