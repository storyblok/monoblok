import type { CommandOptions } from "../../../types";
import type { MigrationFormat } from "../content-migrations";

/** The block state a `.before.ts` snapshot holds. */
export const SNAPSHOT_SOURCES = ["current", "before-push"] as const;
export type SnapshotSource = (typeof SNAPSHOT_SOURCES)[number];

export interface MigrationsGenerateOptions extends CommandOptions {
  suffix?: string;
  format: MigrationFormat;
  schema?: string;
  /** `false` is `--no-snapshot`. */
  snapshot: SnapshotSource | false;
}
