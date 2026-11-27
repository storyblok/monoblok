import { type Command, Option } from "commander";
import chalk from "chalk";

import { type MigrationsGenerateOptions, SNAPSHOT_SOURCES } from "./constants";
import { colorPalette, commands } from "../../../constants";
import { CommandError, handleError, requireAuthentication } from "../../../utils";
import { session } from "../../../session";
import {
  fetchComponent,
  fetchComponentGroups,
  fetchComponents,
} from "../../../commands/components";
import { migrationsCommand } from "../command";
import { generateMigration, hasMigrationSince, latestPushChanging } from "./actions";
import {
  MIGRATION_FORMATS,
  warnJsMigrationsDeprecated,
  writeContentMigration,
} from "../content-migrations";
import { displayPath } from "../../schema/utils";
import { getUI } from "../../../lib/ui";
import { getLogger } from "../../../lib/logger/logger";
import { isFile, sanitizeFilename } from "../../../utils/filesystem";

const generateCmd = migrationsCommand
  .command("generate [componentName]")
  .description("Generate a migration file")
  .option(
    "--su, --suffix <suffix>",
    "suffix to add to the file name (e.g. {component-name}.<suffix>.js; with --format typed, appended to the slug)",
  )
  .option("-s, --space <space>", "space ID")
  // @todo(next-major): Remove `--format` once `js` goes; always write typed migrations.
  .addOption(
    new Option(
      "--format <format>",
      "js writes a .js migration function (deprecated), typed a defineMigration file",
    )
      .choices(MIGRATION_FORMATS)
      .default("js"),
  )
  .option(
    "--schema <entry-file>",
    "with --format typed, the schema entry file that exports type Schema",
  )
  .addOption(
    new Option(
      "--snapshot <source>",
      "with --format typed, the block state the .before.ts snapshot holds: current, or before-push for the block as it was before the latest schema push that changed it",
    )
      .choices(SNAPSHOT_SOURCES)
      .default("current"),
  )
  .addOption(new Option("--no-snapshot", "with --format typed, skip the .before.ts snapshot"));

generateCmd.action(
  async (
    componentName: string | undefined,
    options: MigrationsGenerateOptions,
    command: Command,
  ) => {
    const ui = getUI();
    const logger = getLogger();

    ui.title(
      `${commands.MIGRATIONS}`,
      colorPalette.MIGRATIONS,
      componentName
        ? `Generating migration for component ${componentName}...`
        : "Generating migrations...",
    );

    const { space, path, verbose } = command.optsWithGlobals();
    const { suffix, format, schema: schemaEntry, snapshot } = options;
    const typed = format === "typed";
    const beforePush = snapshot === "before-push";

    logger.info("Migration generation started", {
      componentName,
      space,
      suffix,
    });

    if (!componentName) {
      handleError(
        new CommandError(
          `Please provide the component name as argument ${chalk.hex(colorPalette.MIGRATIONS)("storyblok migrations generate YOUR_COMPONENT_NAME.")}`,
        ),
        verbose,
      );
      return;
    }

    if (suffix && sanitizeFilename(suffix) !== suffix) {
      handleError(
        new CommandError(
          `Invalid suffix "${suffix}". The suffix becomes part of the file name, so it cannot contain path separators or characters that are not allowed in file names.`,
        ),
        verbose,
      );
      return;
    }

    if (typed && !schemaEntry) {
      handleError(
        new CommandError(
          "--format typed types the migration against your schema, so it requires --schema <entry-file>.",
        ),
        verbose,
      );
      return;
    }
    if (!typed && schemaEntry) {
      handleError(
        new CommandError("--schema types a defineMigration file, so it requires --format typed."),
        verbose,
      );
      return;
    }
    if (beforePush && !typed) {
      handleError(
        new CommandError(
          "--snapshot before-push snapshots the block for a typed content migration, so it requires --format typed.",
        ),
        verbose,
      );
      return;
    }

    const { state } = session();

    if (!requireAuthentication(state, verbose)) {
      return;
    }
    if (!space) {
      handleError(
        new CommandError(`Please provide the space as argument --space YOUR_SPACE_ID.`),
        verbose,
      );
      return;
    }

    if (schemaEntry && !(await isFile(schemaEntry))) {
      handleError(
        new CommandError(`Schema entry file not found or not a file: ${schemaEntry}`),
        verbose,
      );
      return;
    }
    if (!typed && snapshot === false) {
      ui.warn("--no-snapshot has no effect without --format typed.");
    }

    const spinner = ui.createSpinner(`Generating migration for component ${componentName}...`);
    try {
      const snapshotted = schemaEntry && snapshot !== false;
      // Without --snapshot before-push, the push only informs a hint, so an
      // unreadable changeset must not stop the command.
      const push = snapshotted
        ? await latestPushChanging(path, space, componentName).catch((error: unknown) => {
            if (beforePush) throw error;
            return undefined;
          })
        : undefined;
      if (beforePush && !push) {
        spinner.failed(`Failed to generate migration for component ${componentName}`);
        handleError(
          new CommandError(
            `No schema push to space ${space} recorded a change to ${componentName}, so there is no earlier state to snapshot. Run without --snapshot before-push.`,
          ),
          verbose,
        );
        return;
      }
      if (beforePush && push?.created) {
        spinner.failed(`Failed to generate migration for component ${componentName}`);
        handleError(
          new CommandError(
            `${componentName} didn't exist before the schema push at ${push.timestamp}, so there is no earlier state to snapshot. Run without --snapshot before-push.`,
          ),
          verbose,
        );
        return;
      }
      // A content migration written since the push was written against the
      // pushed schema, so a new one most likely starts from there too.
      if (
        push &&
        !push.created &&
        !beforePush &&
        !(await hasMigrationSince(path, space, push).catch(() => false))
      ) {
        ui.warn(
          `schema push changed ${componentName} at ${push.timestamp}, so the snapshot describes the block after that push. Pass --snapshot before-push to snapshot it as it was before.`,
        );
      }
      const components = !snapshotted
        ? undefined
        : beforePush && push
          ? push.components
          : await fetchComponents(space);
      const folders = !snapshotted
        ? undefined
        : beforePush && push
          ? push.folders
          : await fetchComponentGroups(space);
      const nameInComponents = beforePush && push ? push.block : componentName;
      const component = components
        ? components.find((candidate) => candidate.name === nameInComponents)
        : await fetchComponent(space, componentName);

      if (!component) {
        spinner.failed(
          `Failed to fetch component ${componentName}. Make sure the component exists in your space.`,
        );
        handleError(new CommandError(`No component found with name "${componentName}"`), verbose);
        return;
      }

      const written = schemaEntry
        ? await writeContentMigration({
            path,
            space,
            name: suffix ? `${component.name}-${suffix}` : component.name,
            schemaEntry,
            ops: [],
            before: components ? { components, folders, blocks: [component.name] } : undefined,
          })
        : { migrationPath: await generateMigration(space, path, component, suffix) };
      const [migrationPath, ...snapshotPaths] = [written.migrationPath, written.beforePath]
        .filter((file) => file !== undefined)
        .map((file) => displayPath(file, path));

      spinner.succeed(
        `Migration generated for component ${chalk.hex(colorPalette.MIGRATIONS)(componentName)} - Completed in ${spinner.elapsedTime.toFixed(2)}ms`,
      );

      ui.ok(
        `You can find the migration file in ${chalk.hex(colorPalette.MIGRATIONS)(migrationPath)}`,
      );
      for (const snapshotPath of snapshotPaths) {
        ui.ok(`Schema snapshot: ${chalk.hex(colorPalette.MIGRATIONS)(snapshotPath)}`);
      }
      if (!typed) {
        warnJsMigrationsDeprecated("--format typed --schema <entry-file>");
      }

      logger.info("Migration generation finished", {
        componentName: component.name,
        migrationPath,
        snapshotPaths,
        space,
        suffix,
      });
    } catch (error) {
      spinner.failed(`Failed to generate migration for component ${componentName}`);
      handleError(error as Error, verbose);
    }
  },
);
