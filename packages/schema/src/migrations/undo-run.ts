/**
 * Undoes a recorded run in two steps around the caller's reads: `planUndo`
 * names the stories to fetch, `undoStories` replays the run's inverse against
 * them as they stand now, not against a snapshot, so an editor who changed a
 * block since the migration ran is reported rather than silently overwritten.
 */
import type { StoryForMigration } from "./apply-migration";
import type { Journal, MigrationRun, StoryInverse } from "./journal";
import { MigrationError } from "./migration-error";
import { applyPatches, uidsIn } from "./patch";
import type { ApplyConflict, BlockPatch } from "./patch";

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
  const later = await laterRunsSharingBlocks(input.journal, run, inverse);
  if (later.length > 0) {
    throw new MigrationError(
      `Run ${input.id} can't be undone while later runs that changed the same blocks are still applied: undoing it would remove content they built on. Undo them first, newest first:\n${[
        ...later,
      ]
        .reverse()
        .map((id) => `  - ${id}`)
        .join("\n")}`,
    );
  }
  return { run, inverse, stories: inverse.map((entry) => entry.story) };
}

/**
 * A later run may have read, rewritten, or moved a block this run changed, and
 * the inverse cannot tell: when the later run left a value this run wrote in
 * place, the value looks untouched, so the undo would remove it silently.
 * Runs are therefore undone newest first wherever they share a block.
 */
async function laterRunsSharingBlocks(
  journal: Journal,
  run: MigrationRun,
  inverse: StoryInverse[],
): Promise<string[]> {
  const runs = await journal.list(run.space);
  const position = runs.findIndex((entry) => entry.id === run.id);
  const later = runs.slice(position + 1).filter((entry) => !entry.undoneAt);
  if (later.length === 0) return [];

  const touched = blocksByStory(inverse);
  const sharing: string[] = [];
  for (const entry of later) {
    const theirs = blocksByStory(await journal.readInverse(entry.id));
    const overlaps = [...theirs].some(([story, uids]) => {
      const ours = touched.get(story);
      return ours !== undefined && [...uids].some((uid) => ours.has(uid));
    });
    if (overlaps) sharing.push(entry.id);
  }
  return sharing;
}

/** Each story's patched blocks, plus every block nested in what the patches insert or remove. */
function blocksByStory(inverse: StoryInverse[]): Map<number, Set<string>> {
  return new Map(
    inverse.map((entry) => [
      entry.story,
      new Set(entry.patches.flatMap((patch) => [patch.uid, ...uidsIn(patch.ops)])),
    ]),
  );
}

export type UndoWrite = {
  story: StoryForMigration;
  content: unknown;
  /** Restores the live version for a story the run published. */
  publish: boolean;
};

export type ConflictingBlock = {
  uid: string;
  component: string;
  /** The fields edited since the run, by their names after the run. */
  fields: string[];
};

export type UndoOutcome = {
  /**
   * Only the stories the inverse actually changed. A story nothing landed on is
   * left out rather than written back untouched: an identical write costs a
   * story version and shows an editor a revision for an undo that did nothing.
   */
  writes: UndoWrite[];
  /**
   * Blocks with a field the run changed and an editor changed since: left as
   * they are, or overwritten under `force`. An edit to a field the run did not
   * touch is kept without a conflict.
   */
  conflicts: { slug: string; blocks: ConflictingBlock[] }[];
  /** Blocks the run recorded that the story no longer holds, so nothing to undo. */
  missing: { slug: string; count: number }[];
  /** Stories {@link UndoStoriesInput.stories} did not include. */
  unread: number[];
  /**
   * Stories the run published that undo leaves as drafts: their draft moved on
   * since the run, they were unpublished since, or their publish state was not
   * passed in. Publishing them could ship an editor's unpublished work.
   */
  notRepublished: string[];
  /**
   * Stories the run published for the first time. Undo restores their draft
   * but leaves them published; unpublish them if they should not be live.
   */
  firstPublishedByRun: string[];
};

export type UndoStoriesInput = {
  inverse: StoryInverse[];
  /**
   * The stories {@link UndoPlan.stories} named, as they stand now. Pass
   * `published` and `unpublished_changes`: without them a story the run
   * published is not republished.
   */
  stories: StoryForMigration[];
  /**
   * Overwrite blocks an editor changed since the run. A block whose uid the
   * story now holds elsewhere is still left alone, so the story never ends up
   * with a repeated uid.
   */
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
    firstPublishedByRun: [],
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
    if (probe.conflicts.length > 0) {
      outcome.conflicts.push({
        slug: story.slug,
        blocks: conflictingBlocks(probe.conflicts, entry.patches),
      });
    }
    if (probe.missing.length > 0) {
      outcome.missing.push({ slug: story.slug, count: probe.missing.length });
    }

    const content = structuredClone(story.content);
    const result = applyPatches(content, entry.patches, { force: input.force });
    if (result.applied === 0) {
      continue;
    }

    let publish = false;
    if (entry.publishedByRun && !entry.before.published) {
      outcome.firstPublishedByRun.push(story.slug);
    } else if (entry.publishedByRun) {
      // Republishing ships the whole draft, so it needs positive evidence that
      // the draft holds nothing but the migration and the story is still live.
      publish = story.published === true && story.unpublished_changes === false;
      if (!publish) outcome.notRepublished.push(story.slug);
    }
    outcome.writes.push({ story, content, publish });
  }

  return outcome;
}

/** Groups per-op conflicts by block: a rename inverse is two ops on one block. */
function conflictingBlocks(conflicts: ApplyConflict[], patches: BlockPatch[]): ConflictingBlock[] {
  const byUid = new Map<string, ConflictingBlock>();
  for (const conflict of conflicts) {
    const block = byUid.get(conflict.uid) ?? {
      uid: conflict.uid,
      component: patches.find((patch) => patch.uid === conflict.uid)?.component ?? "",
      fields: [],
    };
    if (!block.fields.includes(conflict.key)) block.fields.push(conflict.key);
    byUid.set(conflict.uid, block);
  }
  return [...byUid.values()];
}
