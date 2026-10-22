/** Renders journal entries for the terminal. Metadata only: no patch bodies. */
import type { MigrationRun } from "@storyblok/schema/migrations";

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Renders runs in the order given. `MigrationRun.id` sorts chronologically
 * (see the engine's journal), so the caller can hand this function whatever
 * order `Journal.list` returned without this function re-deriving it.
 */
export function formatRuns(runs: MigrationRun[]): string[] {
  return runs.map(
    (run) =>
      `${run.id}  ${run.title ?? run.migration}  ${plural(run.stories, "story", "stories")}, ${plural(run.blocks, "block", "blocks")}`,
  );
}
