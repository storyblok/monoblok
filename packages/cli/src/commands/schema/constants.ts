import { join } from 'pathe';

import { DEFAULT_STORAGE_DIR } from '../../utils/filesystem';

/**
 * Directory holding the code-defined schema, relative to the CLI's base path
 * (`--path`, default `.storyblok`). `schema push` writes its changesets to a
 * `changesets/` directory beneath it.
 */
export const SCHEMA_DIR_NAME = 'schema';

/** Entry file `schema init` writes and `schema push` expects. */
export const SCHEMA_ENTRY_FILENAME = 'schema.ts';

/** Entry file path relative to the CLI's base path, e.g. `schema/schema.ts`. */
export const SCHEMA_ENTRY_RELATIVE_PATH = join(SCHEMA_DIR_NAME, SCHEMA_ENTRY_FILENAME);

/**
 * The entry file path under the default base path, for help text and messages.
 * Prefer resolving against the user's `--path` in code, this constant exists so
 * user-facing copy cannot drift from the default behaviour.
 */
export const DEFAULT_SCHEMA_ENTRY_PATH = join(DEFAULT_STORAGE_DIR, SCHEMA_ENTRY_RELATIVE_PATH);

/** Default `--out-dir` for `schema init`. */
export const DEFAULT_SCHEMA_DIR = join(DEFAULT_STORAGE_DIR, SCHEMA_DIR_NAME);
