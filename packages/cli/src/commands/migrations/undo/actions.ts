/**
 * Replays a recorded run's inverse against content as it stands now, not
 * against a snapshot: an editor who changed a block since the migration ran is
 * reported as a conflict rather than silently overwritten.
 */
import { applyPatches } from "@storyblok/schema/migrations";
import type { Journal } from "@storyblok/schema/migrations";
import { CommandError } from "../../../utils";
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
  /** The space the undo runs against; a run recorded for another one is refused. */
  space: string;
  id: string;
  fetchStory: (id: number) => Promise<StoryForMigration>;
};

export async function undoRun(input: UndoInput): Promise<UndoOutcome> {
  // Both guards hang off the ledger entry, which is why it is consulted at all:
  // deciding from the patches alone would report a cheerful no-op for an id the
  // journal does not hold, since an unknown id yields an empty patch list rather
  // than an error. A run id also does not carry the space it was recorded for,
  // and the journal finds an entry wherever it sits, so the entry is the only
  // thing that can tell this run apart from one belonging to another space.
  const run = await input.journal.read(input.id);
  if (!run) {
    throw new CommandError(
      `No recorded run "${input.id}". Run \`storyblok migrations list --space <id>\` to see what is recorded.`,
    );
  }
  if (run.space !== input.space) {
    throw new CommandError(
      `Run ${input.id} was recorded for space ${run.space}, not space ${input.space}. Undo it with --space ${run.space}.`,
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
