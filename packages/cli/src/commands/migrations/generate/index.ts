import type { Command } from "commander";
import chalk from "chalk";
import { relative } from "pathe";

import type { MigrationsGenerateOptions } from "./constants";
import { colorPalette, commands } from "../../../constants";
import { CommandError, handleError, requireAuthentication } from "../../../utils";
import { session } from "../../../session";
import { fetchComponent, fetchComponents } from "../../../commands/components";
import { migrationsCommand } from "../command";
import { generateMigration } from "./actions";
import { writeContentMigration } from "../content-migrations";
import { getUI } from "../../../lib/ui";
import { getLogger } from "../../../lib/logger/logger";
import { fileExists, sanitizeFilename } from "../../../utils/filesystem";

const generateCmd = migrationsCommand
  .command("generate [componentName]")
  .description("Generate a migration file")
  .option(
    "--su, --suffix <suffix>",
    "suffix to add to the file name (e.g. {component-name}.<suffix>.js)",
  )
  .option("-s, --space <space>", "space ID")
  .option(
    "--schema <entry-file>",
    "schema entry file; generates a typed defineMigration file instead of a legacy .js one",
  )
  .option("--no-before", "skip the .before.ts schema snapshot beside a defineMigration file")
  .option("--js", "generate a legacy .js migration even when --schema is set");

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
    const { suffix, schema, js, before } = options;
    const typed = Boolean(schema) && !js;

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

    if (typed && !(await fileExists(schema as string))) {
      handleError(new CommandError(`Schema entry file not found: ${schema}`), verbose);
      return;
    }

    const spinner = ui.createSpinner(`Generating migration for component ${componentName}...`);
    try {
      const components = typed && before ? await fetchComponents(space) : undefined;
      const component = components
        ? components.find((candidate) => candidate.name === componentName)
        : await fetchComponent(space, componentName);

      if (!component) {
        spinner.failed(
          `Failed to fetch component ${componentName}. Make sure the component exists in your space.`,
        );
        handleError(new CommandError(`No component found with name "${componentName}"`), verbose);
        return;
      }

      const migrationPath = typed
        ? (
            await writeContentMigration({
              path,
              space,
              name: suffix ? `${component.name}-${suffix}` : component.name,
              schemaEntry: schema as string,
              ops: [],
              before: components ? { components, reads: [component.name] } : undefined,
            })
          ).migrationPath
        : await generateMigration(space, path, component, suffix);
      // A `--path` outside the current directory relativizes to an unreadable
      // chain of `..` segments, so show the absolute path instead.
      const relativePath = relative(process.cwd(), migrationPath);
      const displayPath = relativePath.startsWith("..") ? migrationPath : relativePath;

      spinner.succeed(
        `Migration generated for component ${chalk.hex(colorPalette.MIGRATIONS)(componentName)} - Completed in ${spinner.elapsedTime.toFixed(2)}ms`,
      );

      ui.ok(
        `You can find the migration file in ${chalk.hex(colorPalette.MIGRATIONS)(displayPath)}`,
      );

      logger.info("Migration generation finished", {
        componentName: component.name,
        migrationPath: displayPath,
        space,
        suffix,
      });
    } catch (error) {
      spinner.failed(`Failed to generate migration for component ${componentName}`);
      handleError(error as Error, verbose);
    }
  },
);
