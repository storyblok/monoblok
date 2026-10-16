/**
 * TypeScript source generation for `.before.ts` snapshots and `defineMigration`
 * files. Functions return source strings; writing them is the caller's concern,
 * so importing this module works in any runtime.
 *
 * @experimental The text of the generated source is not covered by semver.
 */
export { generateMigrationSource } from "./migration-source";
export type { GenerateMigrationSourceOptions, MigrationOpSource } from "./migration-source";
export { generateSnapshot } from "./snapshot";
export type { GenerateSnapshotOptions, WireComponent } from "./snapshot";
