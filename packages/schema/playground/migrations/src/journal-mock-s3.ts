/**
 * A second journal backend, so the interface is held to more than one
 * implementation. It stores nothing: every write is logged instead of sent, and
 * the records live in memory for the length of the process.
 *
 * The logging is the point. It shows the shape a real remote backend wants —
 * the ledger entry is a small row in a database, the inverse patches are one
 * object in blob storage — which is the split the interface exists to allow and
 * the reason the two halves are separate methods.
 */
import type { Journal, MigrationRun, StoryInverse } from "@storyblok/schema/migrations";

export function mockS3Journal(bucket: string, log: (line: string) => void = console.info): Journal {
  const runs = new Map<string, MigrationRun>();
  const inverses = new Map<string, StoryInverse[]>();

  return {
    async record(run, inverse) {
      const blocks = inverse.reduce((total, entry) => total + entry.patches.length, 0);
      // The patches go first: an orphaned patch object is inert, whereas a
      // ledger entry pointing at patches that were never stored is a rollback
      // that fails when it is needed.
      log(
        `[mock-s3] PUT s3://${bucket}/${run.space}/${run.id}.patches.json ` +
          `(${inverse.length} stories, ${blocks} blocks)`,
      );
      inverses.set(run.id, inverse);
      log(`[mock-s3] INSERT migration_runs id=${run.id} migration=${run.migration}`);
      runs.set(run.id, run);
    },

    async list(space) {
      log(`[mock-s3] SELECT * FROM migration_runs WHERE space = '${space}' ORDER BY applied_at`);
      return [...runs.values()]
        .filter((run) => run.space === space)
        .sort((a, b) => a.appliedAt.localeCompare(b.appliedAt));
    },

    async read(id) {
      log(`[mock-s3] SELECT * FROM migration_runs WHERE id = '${id}'`);
      return runs.get(id);
    },

    async readInverse(id) {
      log(`[mock-s3] GET s3://${bucket}/${id}.patches.json`);
      return inverses.get(id) ?? [];
    },
  };
}
