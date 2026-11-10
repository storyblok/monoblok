import { isDeepStrictEqual } from "node:util";
import chalk from "chalk";
import { planUndo, undoStories } from "@storyblok/schema";
import type { StoryForMigration, StoryInverse } from "@storyblok/schema";
import { CommandError, isRecord, toError } from "../../../utils";
import { APIError } from "../../../utils/error/api-error";
import { getLogger } from "../../../lib/logger/logger";
import { getUI } from "../../../lib/ui";
import {
  contentJournal,
  DraftNotPublishedError,
  guardPendingReleases,
  plural,
  storyAccess,
  toStoryForMigration,
} from "../content-migrations";

export type RollbackContentMigrationRunOptions = {
  space: string;
  path: string | undefined;
  /** The recorded run to roll back; defaults to the most recent one not yet rolled back. */
  id?: string;
  force: boolean;
  allowPendingReleases: boolean;
};

/**
 * Rolls back a recorded content migration run block by block. Blocks with
 * fields changed since the run are left as they are unless `force` is set.
 */
export async function rollbackContentMigrationRun({
  space,
  path,
  id: requestedRun,
  force,
  allowPendingReleases,
}: RollbackContentMigrationRunOptions): Promise<void> {
  const ui = getUI();
  const logger = getLogger();

  const journal = contentJournal(path);

  let id = requestedRun;
  if (!id) {
    const runs = await journal.list(space);
    const latest = runs.findLast((run) => !run.undoneAt);
    if (!latest) {
      throw new CommandError(
        runs.length === 0
          ? `No content migration runs recorded for space ${space}. Name a rollback file to roll back a run of migration functions; list them with "storyblok migrations list --space ${space}".`
          : `Every content migration run recorded for space ${space} is already rolled back.`,
      );
    }
    id = latest.id;
    // Named before anything is touched, so a rollback of the wrong run is visible.
    ui.info(
      `Rolling back the most recent run ${chalk.bold(id)} (${latest.title ?? latest.migration}).`,
    );
  }

  if (requestedRun && !(await journal.read(requestedRun))) {
    throw new CommandError(
      `No recorded run or rollback file "${requestedRun}" for space ${space}. List them with "storyblok migrations list --space ${space}".`,
    );
  }

  const plan = await planUndo({ journal, space, id });
  if (plan.run.undoneAt) {
    ui.info(`Run ${chalk.bold(id)} was already rolled back at ${plan.run.undoneAt}.`);
  }
  await guardPendingReleases(space, { command: "rollback", allow: allowPendingReleases });

  const access = storyAccess(space);
  const stories: StoryForMigration[] = [];
  /** By slug while the story is in the trash, by id once it is gone. */
  const deleted: (string | number)[] = [];
  /** Stories that could not be read or written, so a republish they wait for stays pending. */
  const unsettled = new Set<number>();
  let failed = 0;
  for (const storyId of plan.stories) {
    try {
      const story = await access.read(storyId);
      if (story?.deleted_at) {
        deleted.push(toStoryForMigration(story).slug);
      } else if (story) {
        stories.push(toStoryForMigration(story));
      }
    } catch (maybeError) {
      if (maybeError instanceof APIError && maybeError.errorId === "not_found") {
        deleted.push(storyId);
        continue;
      }
      failed++;
      unsettled.add(storyId);
      const error = toError(maybeError);
      ui.warn(`Story ${storyId} could not be read, so it was not rolled back: ${error.message}`);
      logger.error("Failed to read story", { storyId, run: id, space, error });
    }
  }
  if (deleted.length > 0) {
    ui.warn(
      `${plural(deleted.length, "story was", "stories were")} deleted since the run, so there is nothing to roll back there: ${deleted.join(", ")}`,
    );
  }

  const outcome = undoStories({ inverse: plan.inverse, stories, force });

  for (const conflict of outcome.conflicts) {
    const count = conflict.blocks.length;
    const changed = `${chalk.bold(conflict.slug)}: ${plural(count, "block was", "blocks were")} changed since the run`;
    const blocks = conflict.blocks
      .map((block) => `${block.component} ${block.uid} (${block.fields.join(", ")})`)
      .join("; ");
    ui.warn(
      force
        ? `${changed} and will be overwritten: ${blocks}`
        : `${changed} and ${count === 1 ? "is" : "are"} left as ${count === 1 ? "it is" : "they are"}: ${blocks}. Pass --force to overwrite.`,
    );
  }
  for (const gone of outcome.missing) {
    ui.warn(
      `${chalk.bold(gone.slug)}: ${plural(gone.count, "block", "blocks")} the run changed ${gone.count === 1 ? "is" : "are"} no longer in the story; nothing to roll back there.`,
    );
  }

  const restored = new Set<string>();
  const republished = new Set<string>();
  /** Restored drafts whose publish failed, so the live version still holds the run's content. */
  const stillLive = new Map<number, { slug: string; draft: unknown }>();
  const failedWrites = new Set<string>();
  for (const write of outcome.writes) {
    if (!isRecord(write.content)) {
      continue;
    }
    try {
      await access.write(write.story.id, write.content, write.publish);
      (write.publishOnly ? republished : restored).add(write.story.slug);
      logger.info(write.publishOnly ? "Restored draft published" : "Story rolled back", {
        storyId: write.story.id,
        run: id,
        space,
      });
    } catch (maybeError) {
      if (maybeError instanceof DraftNotPublishedError) {
        if (!write.publishOnly) restored.add(write.story.slug);
        stillLive.set(write.story.id, { slug: write.story.slug, draft: write.content });
        ui.warn(
          `${chalk.bold(write.story.slug)}: ${write.publishOnly ? "publishing the restored draft failed" : "the draft was restored, but publishing it failed"}: ${maybeError.message}`,
        );
        logger.error("Failed to publish rolled back story", {
          storyId: write.story.id,
          run: id,
          space,
          error: maybeError,
        });
        continue;
      }
      failed++;
      unsettled.add(write.story.id);
      failedWrites.add(write.story.slug);
      const error = toError(maybeError);
      ui.warn(`${chalk.bold(write.story.slug)} could not be written: ${error.message}`);
      logger.error("Failed to roll back story", { storyId: write.story.id, run: id, space, error });
    }
  }

  const notRepublished = outcome.notRepublished.filter((slug) => !failedWrites.has(slug));
  if (notRepublished.length > 0) {
    ui.warn(
      `The run published ${plural(notRepublished.length, "story", "stories")} that ${notRepublished.length === 1 ? "was" : "were"} changed or unpublished since, so only the draft was restored: ${notRepublished.join(", ")}`,
    );
  }
  const firstPublished = outcome.firstPublishedByRun.filter((slug) => restored.has(slug));
  if (firstPublished.length > 0) {
    const one = firstPublished.length === 1;
    ui.warn(
      `The run published ${plural(firstPublished.length, "story", "stories")} for the first time. The draft was restored, but ${one ? "it stays" : "they stay"} published. Unpublish any that shouldn't be live: ${firstPublished.join(", ")}`,
    );
  }

  const keptChanges = new Set(force ? [] : outcome.conflicts.map((conflict) => conflict.slug));
  const written = new Set(outcome.writes.map((write) => write.story.slug));
  const partly = [...restored].filter((slug) => keptChanges.has(slug)).length;
  const leftAsIs = [...keptChanges].filter((slug) => !written.has(slug)).length;
  const stillLiveSlugs = [...stillLive.values()].map(({ slug }) => slug);
  const handled = new Set([...restored, ...republished, ...stillLiveSlugs]);
  const nothingToUndo = plan.stories.length - handled.size - leftAsIs - failed;
  const tally = [
    republished.size > 0 &&
      `published the restored draft of ${plural(republished.size, "story", "stories")}`,
    leftAsIs > 0 && `${plural(leftAsIs, "story", "stories")} left as changed since the run`,
    nothingToUndo > 0 &&
      `${plural(nothingToUndo, "story", "stories")} had nothing left to roll back`,
    failed > 0 && `${plural(failed, "story", "stories")} failed`,
  ].filter(Boolean);
  ui.info(
    `Rolled back ${plural(restored.size, "story", "stories")}${partly > 0 ? ` (${partly} partly)` : ""} of run ${chalk.bold(id)}${tally.map((part) => `; ${part}`).join("")}.`,
  );

  // Blocks left in place keep the run open, so `rollback --force` without a run
  // still reaches them. So does a failed republish, so a later rollback
  // publishes the restored draft once the space accepts it.
  const inverse = plan.inverse.map(({ pendingRepublish, ...entry }): StoryInverse => {
    const live = stillLive.get(entry.story);
    if (live) return { ...entry, pendingRepublish: { draft: live.draft } };
    return pendingRepublish && unsettled.has(entry.story) ? { ...entry, pendingRepublish } : entry;
  });
  const complete =
    failed === 0 && (outcome.conflicts.length === 0 || force) && stillLive.size === 0;
  const now = new Date().toISOString();
  if (complete) {
    await journal.record({ ...plan.run, undoneAt: plan.run.undoneAt ?? now }, inverse);
  } else if (handled.size > 0 || !isDeepStrictEqual(inverse, plan.inverse)) {
    await journal.record({ ...plan.run, partlyUndoneAt: now }, inverse);
  }
  // The space validates content against its current schema, which may no
  // longer accept the content as it was before the run.
  const keptBlocks = force
    ? 0
    : outcome.conflicts.reduce((total, conflict) => total + conflict.blocks.length, 0);
  const problems = [
    keptBlocks > 0 &&
      `The run is only partly rolled back: ${plural(keptBlocks, "block was", "blocks were")} changed since the run and left as ${keptBlocks === 1 ? "it is" : "they are"}. Run "storyblok migrations rollback ${id} --force" to overwrite ${keptBlocks === 1 ? "it" : "them"}.`,
    failed > 0 &&
      `${plural(failed, "story", "stories")} could not be rolled back. See the warnings above. If the schema changed since the run, push the schema as it was before the run first, then run "storyblok migrations rollback ${id}" again.`,
    stillLive.size > 0 &&
      `${plural(stillLive.size, "story still publishes", "stories still publish")} the content the run published, because publishing the restored draft failed: ${stillLiveSlugs.join(", ")}. Push the schema as it was before the run, then run "storyblok migrations rollback ${id}" again to publish the restored ${stillLive.size === 1 ? "draft" : "drafts"}.`,
  ].filter(Boolean);
  if (problems.length > 0) {
    throw new CommandError(problems.join("\n"));
  }
}
