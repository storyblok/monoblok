/**
 * Replays a recorded run's inverse against content as it stands now, not
 * against a snapshot: an editor who changed a block since the migration ran is
 * reported as a conflict rather than silently overwritten.
 */
import { applyPatches } from "@storyblok/schema/migrations";
import type { Journal } from "@storyblok/schema/migrations";
import type { StoryForMigration } from "../apply/actions";

export type UndoOutcome = {
  /**
   * Only the stories the inverse actually changed. A story nothing landed on is
   * left out rather than written back untouched: an identical write costs a
   * story version and shows an editor a revision for an undo that did nothing.
   */
  writes: { story: StoryForMigration; content: unknown }[];
  /**
   * Blocks left as they are because an editor changed them since the run.
   * Counted in blocks, like {@link UndoOutcome.missing}: the engine reports one
   * conflict per op, and a rename inverse is two ops on a single block.
   */
  conflicts: { slug: string; count: number }[];
  /** Blocks the run recorded that the story no longer holds, so nothing to undo. */
  missing: { slug: string; count: number }[];
};

export type UndoInput = {
  journal: Journal;
  id: string;
  fetchStory: (id: number) => Promise<StoryForMigration>;
};

export async function undoRun(input: UndoInput): Promise<UndoOutcome> {
  // The ledger entry is read before the patches because an id the journal does
  // not hold yields no patches rather than an error, which would otherwise look
  // like an undo that succeeded having done nothing.
  const run = await input.journal.read(input.id);
  if (!run) {
    throw new Error(
      `No recorded run "${input.id}". Run \`storyblok migrations list --space <id>\` to see what is recorded.`,
    );
  }

  const inverse = await input.journal.readInverse(input.id);
  const writes: UndoOutcome["writes"] = [];
  const conflicts: UndoOutcome["conflicts"] = [];
  const missing: UndoOutcome["missing"] = [];

  for (const entry of inverse) {
    const story = await input.fetchStory(Number(entry.story));
    const content = structuredClone(story.content);
    const result = applyPatches(content, entry.patches);
    const conflictingBlocks = new Set(result.conflicts.map((conflict) => conflict.uid));
    if (conflictingBlocks.size > 0) {
      conflicts.push({ slug: story.slug, count: conflictingBlocks.size });
    }
    if (result.missing.length > 0) {
      missing.push({ slug: story.slug, count: result.missing.length });
    }
    if (result.applied === 0) {
      continue;
    }
    writes.push({ story, content });
  }

  return { writes, conflicts, missing };
}
