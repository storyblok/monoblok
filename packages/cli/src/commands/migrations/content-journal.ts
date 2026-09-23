/**
 * Resolves the journal a content migration records into.
 *
 * Only the filesystem backend ships. The indirection exists because runs are
 * read through the `Journal` interface rather than off a known path, so a team
 * that needs a shared journal can supply one without the engine changing.
 *
 * The journal root is the migrations directory itself, so a space's runs sit
 * next to the migration files they applied. Run records are JSON and migration
 * files are TypeScript or JavaScript, so neither discovery picks up the other.
 */
import { localJournal } from "@storyblok/schema/migrations";
import type { Journal } from "@storyblok/schema/migrations";
import { resolvePath } from "../../utils/filesystem";

export function resolveJournal(options: { path?: string }): Journal {
  return localJournal(resolvePath(options.path, "migrations"));
}
