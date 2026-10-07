/**
 * Undoes a recorded run in two steps around the caller's reads: `planUndo`
 * names the stories to fetch, `undoStories` replays the run's inverse against
 * them as they stand now, not against a snapshot, so an editor who changed a
 * block since the migration ran is reported rather than silently overwritten.
 */
import type { StoryForMigration } from "./apply-migration";
import type { Journal, MigrationRun, StoryInverse } from "./journal";
import { applyPatches } from "./patch";

export class MigrationError extends Error {
  override name = "MigrationError";
}

export type UndoPlan = {
  run: MigrationRun;
  inverse: StoryInverse[];
  /** The stories to fetch before calling {@link undoStories}. */
  stories: number[];
};

export async function planUndo(input: {
  journal: Journal;
  /** The space the undo runs against; a run recorded for another one is refused. */
  space: string;
  id: string;
}): Promise<UndoPlan> {
  // Both guards hang off the ledger entry: deciding from the patches alone
  // would report a no-op for an id the journal does not hold, since an unknown
  // id yields an empty patch list rather than an error. A run id also does not
  // carry its space, so the entry is the only thing that tells this run apart
  // from one belonging to another space.
  const run = await input.journal.read(input.id);
  if (!run) {
    throw new MigrationError(`No recorded run "${input.id}".`);
  }
  if (run.space !== input.space) {
    throw new MigrationError(
      `Run ${input.id} was recorded for space ${run.space}, not space ${input.space}.`,
    );
  }

  const inverse = await input.journal.readInverse(input.id);
  return { run, inverse, stories: inverse.map((entry) => entry.story) };
}

export type UndoWrite = {
  story: StoryForMigration;
  content: unknown;
  /** Restores the live version for a story the run published. */
  publish: boolean;
};

export type UndoOutcome = {
  /**
   * Only the stories the inverse actually changed. A story nothing landed on is
   * left out rather than written back untouched: an identical write costs a
   * story version and shows an editor a revision for an undo that did nothing.
   */
  writes: UndoWrite[];
  /**
   * Blocks an editor changed since the run: left as they are, or overwritten
   * under `force`. Counted in blocks, like {@link UndoOutcome.missing}: the
   * engine reports one conflict per op, and a rename inverse is two ops on a
   * single block.
   */
  conflicts: { slug: string; count: number }[];
  /** Blocks the run recorded that the story no longer holds, so nothing to undo. */
  missing: { slug: string; count: number }[];
  /** Stories {@link UndoStoriesInput.stories} did not include. */
  unread: number[];
  /**
   * Stories the run published that are left as drafts: their draft moved on
   * since the run, and publishing it would ship an editor's unpublished work.
   */
  notRepublished: string[];
};

export type UndoStoriesInput = {
  inverse: StoryInverse[];
  /** The stories {@link UndoPlan.stories} named, as they stand now. */
  stories: StoryForMigration[];
  /** Overwrite blocks an editor changed since the run. */
  force?: boolean;
};

export function undoStories(input: UndoStoriesInput): UndoOutcome {
  const byId = new Map(input.stories.map((story) => [story.id, story]));
  const outcome: UndoOutcome = {
    writes: [],
    conflicts: [],
    missing: [],
    unread: [],
    notRepublished: [],
  };

  for (const entry of input.inverse) {
    const story = byId.get(entry.story);
    if (!story) {
      outcome.unread.push(entry.story);
      continue;
    }

    // Conflicts are collected on an unforced pass even under `force`, so the
    // caller can say what is about to be overwritten.
    const probe = applyPatches(structuredClone(story.content), entry.patches);
    const conflictingBlocks = new Set(probe.conflicts.map((conflict) => conflict.uid)).size;
    if (conflictingBlocks > 0) {
      outcome.conflicts.push({ slug: story.slug, count: conflictingBlocks });
    }
    if (probe.missing.length > 0) {
      outcome.missing.push({ slug: story.slug, count: probe.missing.length });
    }

    const content = structuredClone(story.content);
    const result = applyPatches(content, entry.patches, { force: input.force });
    if (result.applied === 0) {
      continue;
    }

    const draftMovedOn = story.unpublished_changes === true;
    if (entry.publishedByRun && draftMovedOn) {
      outcome.notRepublished.push(story.slug);
    }
    outcome.writes.push({ story, content, publish: entry.publishedByRun && !draftMovedOn });
  }

  return outcome;
}
