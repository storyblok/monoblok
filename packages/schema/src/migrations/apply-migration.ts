/**
 * Applies one content migration across a set of stories and reports what should
 * be written, without writing anything itself. Keeping the decision separate
 * from the I/O is what lets a dry run be the same code path minus the write:
 * there is no dry-run branch here, so a dry run and a real run cannot disagree
 * about what a migration does.
 */
import type { CompiledMigration } from "./define-migration";
import { type MigrationRun, type PublishState, runId, type StoryInverse } from "./journal";
import { runMigrationOnStory } from "./runner";
import { isRecord } from "../utils/is-record";

/** The fields of a Management API story a migration reads. */
export type StoryForMigration = {
  id: number;
  slug: string;
  content: unknown;
  published?: boolean | null;
  unpublished_changes?: boolean | null;
};

/**
 * Which written stories are also published:
 * - `all`: every one.
 * - `published`: those whose live version matched the draft, so publishing ships
 *   only the migration.
 * - `published-with-changes`: those whose draft was already ahead of the live
 *   version, so publishing also ships an editor's pending changes.
 */
export type PublishMode = "all" | "published" | "published-with-changes";

export type ApplyMigrationInput = {
  migration: CompiledMigration;
  /** Filename-derived migration id, so a repeat run against a space is visible. */
  id: string;
  space: string;
  stories: StoryForMigration[];
  /** Omitted: write drafts only. */
  publish?: PublishMode;
  appliedAt?: Date;
};

export type MigrationWrite = {
  story: StoryForMigration;
  content: Record<string, unknown>;
  publish: boolean;
};

export type ApplyMigrationOutcome = {
  /** The journal entry to record once the writes succeeded. */
  run: MigrationRun;
  inverse: StoryInverse[];
  writes: MigrationWrite[];
  refusals: { slug: string; reason: string }[];
  /**
   * Written stories that are published but whose write is not. Their live
   * version keeps the old shape until anyone publishes them, at which point the
   * migration goes live with no further action.
   */
  publishedDraftOnly: number;
};

function publishStateOf(story: StoryForMigration): PublishState {
  return {
    published: story.published === true,
    unpublishedChanges: story.unpublished_changes === true,
  };
}

function shouldPublish(state: PublishState, mode: PublishMode | undefined): boolean {
  switch (mode) {
    case "all":
      return true;
    case "published":
      return state.published && !state.unpublishedChanges;
    case "published-with-changes":
      return state.published && state.unpublishedChanges;
    default:
      return false;
  }
}

function refusalReason(result: ReturnType<typeof runMigrationOnStory>): string | undefined {
  // Both instabilities are refused, but they have different culprits: content
  // that arrived with repeated ids sends the author to the story, not to the
  // migration.
  if (result.unstableUids.preExisting.length > 0) {
    return `This story already contains repeated block ids (${result.unstableUids.preExisting.join(", ")}); they would be renumbered on write, stranding the record needed to undo the run.`;
  }
  if (result.unstableUids.duplicate.length > 0 || result.unstableUids.missing > 0) {
    const detail =
      result.unstableUids.duplicate.length > 0
        ? `repeated ids ${result.unstableUids.duplicate.join(", ")}`
        : `${result.unstableUids.missing} block(s) without an id`;
    return `The migration left this story with ${detail}; they would be renumbered on write, stranding the record needed to undo the run.`;
  }
  if (result.translatedReshapes.length > 0) {
    const fields = [...new Set(result.translatedReshapes.map((entry) => entry.field))];
    return `Field ${fields.join(", ")} is translated, and splitting or merging a translated field would strand its translations, which are then dropped. Reshape it with \`alterBlock\`, where the translated keys can be handled explicitly.`;
  }
  if (result.nonIdempotent.length > 0) {
    return `Op ${result.nonIdempotent.map((entry) => entry.op).join(", ")} disagrees with itself on a second pass, so running the migration again would keep changing this story.`;
  }
  return undefined;
}

export function applyMigration(input: ApplyMigrationInput): ApplyMigrationOutcome {
  const appliedAt = input.appliedAt ?? new Date();
  const writes: MigrationWrite[] = [];
  const refusals: ApplyMigrationOutcome["refusals"] = [];
  const inverse: StoryInverse[] = [];

  for (const story of input.stories) {
    const result = runMigrationOnStory(input.migration, story.content);
    if (!result.changed) {
      continue;
    }

    const reason = refusalReason(result);
    if (reason) {
      refusals.push({ slug: story.slug, reason });
      continue;
    }

    // The runner returns a clone of the content it was given, so a story whose
    // content is not a block has nothing writable to offer.
    if (!isRecord(result.content)) {
      continue;
    }

    const before = publishStateOf(story);
    const publish = shouldPublish(before, input.publish);
    inverse.push({ story: story.id, patches: result.inverse, before, publishedByRun: publish });
    writes.push({ story, content: result.content, publish });
  }

  return {
    run: {
      id: runId(input.id, appliedAt),
      space: input.space,
      migration: input.id,
      title: input.migration.title,
      appliedAt: appliedAt.toISOString(),
      stories: inverse.length,
      blocks: inverse.reduce((total, entry) => total + entry.patches.length, 0),
    },
    inverse,
    writes,
    refusals,
    publishedDraftOnly: writes.filter((write) => write.story.published === true && !write.publish)
      .length,
  };
}
