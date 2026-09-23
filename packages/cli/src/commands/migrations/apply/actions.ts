/**
 * Applies one content migration across a set of stories and reports what should
 * be written, without writing anything itself. Keeping the decision separate
 * from the I/O is what lets `--dry-run` be the same code path minus the write.
 */
import { runMigrationOnStory } from "@storyblok/schema/migrations";
import type { CompiledMigration, MigrationRun, StoryInverse } from "@storyblok/schema/migrations";
import { isRecord } from "../../../utils";

export type StoryForMigration = {
  id: number;
  slug: string;
  content: unknown;
};

export type ApplyInput = {
  migration: CompiledMigration;
  /** Filename-derived migration id, so a repeat run against a space is visible. */
  id: string;
  space: string;
  stories: StoryForMigration[];
  dryRun: boolean;
};

export type ApplyOutcome = {
  /** The ledger entry for this run. The caller fills in `id`; it owns the clock. */
  run: MigrationRun;
  inverse: StoryInverse[];
  writes: { story: StoryForMigration; content: Record<string, unknown> }[];
  refusals: { slug: string; reason: string }[];
};

export async function applyMigration(input: ApplyInput): Promise<ApplyOutcome> {
  const writes: ApplyOutcome["writes"] = [];
  const refusals: ApplyOutcome["refusals"] = [];
  const inverse: StoryInverse[] = [];

  for (const story of input.stories) {
    const result = runMigrationOnStory(input.migration, story.content);
    if (!result.changed) {
      continue;
    }

    // Both instabilities are refused, but they have different culprits: content
    // that arrived with repeated ids sends the author to the story, not to the
    // migration.
    if (result.unstableUids.preExisting.length > 0) {
      refusals.push({
        slug: story.slug,
        reason: `This story already contains repeated block ids (${result.unstableUids.preExisting.join(", ")}); they would be renumbered on write, stranding the record needed to undo the run.`,
      });
      continue;
    }
    if (result.unstableUids.duplicate.length > 0 || result.unstableUids.missing > 0) {
      const detail =
        result.unstableUids.duplicate.length > 0
          ? `repeated ids ${result.unstableUids.duplicate.join(", ")}`
          : `${result.unstableUids.missing} block(s) without an id`;
      refusals.push({
        slug: story.slug,
        reason: `The migration left this story with ${detail}; they would be renumbered on write, stranding the record needed to undo the run.`,
      });
      continue;
    }
    if (result.nonIdempotent.length > 0) {
      refusals.push({
        slug: story.slug,
        reason: `Op ${result.nonIdempotent.map((entry) => entry.op).join(", ")} disagrees with itself on a second pass, so running the migration again would keep changing this story.`,
      });
      continue;
    }

    // The runner returns a clone of the content it was given, so a story whose
    // content is not a block has nothing writable to offer.
    if (!isRecord(result.content)) {
      continue;
    }

    inverse.push({ story: String(story.id), patches: result.inverse });
    if (!input.dryRun) {
      writes.push({ story, content: result.content });
    }
  }

  return {
    run: {
      id: "",
      space: input.space,
      migration: input.id,
      title: input.migration.title,
      appliedAt: new Date().toISOString(),
      stories: inverse.length,
      blocks: inverse.reduce((total, entry) => total + entry.patches.length, 0),
    },
    inverse,
    writes,
    refusals,
  };
}
