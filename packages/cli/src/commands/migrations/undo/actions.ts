/**
 * Replays a recorded run's inverse against content as it stands now, not
 * against a snapshot: an editor who changed a block since the migration ran is
 * reported as a conflict rather than silently overwritten.
 */
import { applyPatches } from "@storyblok/schema/migrations";
import type { Journal } from "@storyblok/schema/migrations";
import type { StoryForMigration } from "../apply/actions";

export type UndoOutcome = {
  writes: { story: StoryForMigration; content: unknown }[];
  conflicts: { slug: string; count: number }[];
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

  for (const entry of inverse) {
    const story = await input.fetchStory(Number(entry.story));
    const content = structuredClone(story.content);
    const applied = applyPatches(content, entry.patches);
    if (applied.conflicts.length > 0) {
      conflicts.push({ slug: story.slug, count: applied.conflicts.length });
    }
    writes.push({ story, content });
  }

  return { writes, conflicts };
}
