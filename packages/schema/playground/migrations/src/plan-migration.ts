/**
 * Decides what a migration run would write, without writing anything. The same
 * separation the CLI's apply makes: there is no dry-run branch, so what a run
 * reports and what it does cannot disagree.
 */
import { runMigrationOnStory } from "@storyblok/schema/migrations";
import type { CompiledMigration, StoryInverse } from "@storyblok/schema/migrations";
import type { PlaygroundStory } from "./content-store";

export type PlannedWrite = { story: PlaygroundStory; content: Record<string, unknown> };

/**
 * `blame` is the part worth getting right. Both instabilities are refused, but
 * only one of them is the migration's doing: content that arrived with repeated
 * block ids sends the author to the story instead.
 */
export type Refusal = { slug: string; blame: "story" | "migration"; reason: string };

export type MigrationPlan = {
  writes: PlannedWrite[];
  inverse: StoryInverse[];
  refusals: Refusal[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function planMigration(
  migration: CompiledMigration,
  stories: PlaygroundStory[],
): MigrationPlan {
  const plan: MigrationPlan = { writes: [], inverse: [], refusals: [] };

  for (const story of stories) {
    const result = runMigrationOnStory(migration, story.content);
    if (!result.changed) {
      continue;
    }

    // Asked first, because a story that arrived with repeated ids can also pick
    // up an instability from the migration, and the earlier damage is the one
    // that has to be repaired before either is worth reporting.
    if (result.unstableUids.preExisting.length > 0) {
      plan.refusals.push({
        slug: story.slug,
        blame: "story",
        reason: `already contains repeated block ids: ${result.unstableUids.preExisting.join(", ")}`,
      });
      continue;
    }
    if (result.unstableUids.duplicate.length > 0 || result.unstableUids.missing > 0) {
      plan.refusals.push({
        slug: story.slug,
        blame: "migration",
        reason:
          result.unstableUids.duplicate.length > 0
            ? `the migration left repeated block ids: ${result.unstableUids.duplicate.join(", ")}`
            : `the migration left ${result.unstableUids.missing} block(s) without an id`,
      });
      continue;
    }
    if (result.nonIdempotent.length > 0) {
      plan.refusals.push({
        slug: story.slug,
        blame: "migration",
        reason: `op ${result.nonIdempotent.map((entry) => entry.op).join(", ")} disagrees with itself on a second pass`,
      });
      continue;
    }

    // The runner returns a clone of what it was given, so a story whose content
    // is not a block has nothing writable to offer.
    if (!isRecord(result.content)) {
      continue;
    }

    plan.inverse.push({ story: String(story.id), patches: result.inverse });
    plan.writes.push({ story, content: result.content });
  }

  return plan;
}
