import type { Command } from "commander";
import { colorPalette, commands } from "../../../constants";
import { CommandError, FileSystemError, handleError } from "../../../utils";
import { type ComponentsData, readComponentsFiles } from "../../components/push/actions";
import type { GenerateTypesOptions } from "./constants";
import { typesCommand } from "../command";
import { generateStoryblokTypes, generateTypes, saveTypesToComponentsFile } from "./actions";
import { readDatasourcesFiles } from "../../datasources/push/actions";
import type { SpaceDatasourcesData } from "../../../commands/datasources/constants";
import { getUI } from "../../../lib/ui";
import { getLogger } from "../../../lib/logger/logger";
import { DEFAULT_SCHEMA_ENTRY_PATH } from "../../schema/constants";
import { runFutureSchemaTypes } from "./future-schema";

const generateCmd = typesCommand
  .command("generate")
  .description("Generate types d.ts for your component schemas")
  .option(
    "--filename <name>",
    "Base file name for all component types when generating a single declarations file (e.g. components.d.ts). Ignored when using --separate-files.",
  )
  .option(
    "--sf, --separate-files",
    "Generate one .d.ts file per component instead of a single combined file",
  )
  .option("--strict", "strict mode, no loose typing")
  .option("--type-prefix <prefix>", "prefix to be prepended to all generated component type names")
  .option("--type-suffix <suffix>", "suffix to be appended to all generated component type names")
  .option("--suffix <suffix>", "Components suffix")
  .option("--custom-fields-parser <path>", "Path to the parser file for Custom Field Types")
  .option(
    "--compiler-options <options>",
    "path to the compiler options from json-schema-to-typescript",
  )
  .option("-s, --space <space>", "space ID")
  .option("--future-schema", "Generate types from the space schema")
  .option(
    "--field-plugins <path>",
    `Path to a module exporting your defineFieldPlugin declarations (default: ${DEFAULT_SCHEMA_ENTRY_PATH})`,
  );

generateCmd.action(async (options: GenerateTypesOptions, command: Command) => {
  const ui = getUI();
  const { space, path, verbose, suffix, filename, separateFiles } = command.optsWithGlobals();

  if (options.futureSchema) {
    await runFutureSchemaTypes({
      options,
      globals: { space, path, filename, separateFiles, verbose },
      getOptionValueSource: (attributeName) => command.getOptionValueSource(attributeName),
    });
    return;
  }

  ui.title(`${commands.TYPES}`, colorPalette.TYPES, "Generating types...");
  ui.warn(
    "`types generate` without --future-schema is deprecated. The legacy generator does not follow " +
      "field `required` flags, block whitelists, or nestable/root distinctions. Re-run with --future-schema.",
  );
  if (options.fieldPlugins !== undefined) {
    ui.warn("--field-plugins is ignored without --future-schema.");
  }

  if (!space) {
    handleError(
      new CommandError("Please provide the space as argument --space SPACE_ID."),
      verbose,
    );
    return;
  }

  const logger = getLogger();
  const spinner = ui.createSpinner("Processing schemas...");

  try {
    logger.info("Generating types started", { space });

    // Input format is auto-detected based on files on disk
    const componentsData = await readComponentsFiles({
      from: space,
      path,
      suffix,
      verbose,
    });
    // Try to read datasources, but make it optional
    let dataSourceData: SpaceDatasourcesData;
    try {
      dataSourceData = await readDatasourcesFiles({
        from: space,
        path,
        suffix,
        verbose,
      });
    } catch (error) {
      // Only catch the specific case where datasources don't exist
      if (error instanceof FileSystemError && error.errorId === "file_not_found") {
        dataSourceData = { datasources: [] };
      } else {
        throw error;
      }
    }
    await generateStoryblokTypes({
      path,
    });

    // Add empty datasources array to match expected type for generateTypes
    const spaceDataWithComponentsAndDatasources: ComponentsData & SpaceDatasourcesData = {
      ...componentsData,
      ...dataSourceData,
    };

    logger.info("Processing schemas", {
      components: componentsData.components.length,
      datasources: dataSourceData.datasources.length,
    });

    const typedefData = await generateTypes(spaceDataWithComponentsAndDatasources, {
      ...options,
    });

    if (!typedefData) {
      spinner.failed("No types generated");
      return;
    }

    await saveTypesToComponentsFile(space, typedefData, {
      filename,
      path,
      separateFiles,
    });

    spinner.succeed(`Types generated for ${componentsData.components.length} components`);

    if (separateFiles && filename) {
      ui.warn(`The --filename option is ignored when using --separate-files`);
    }

    logger.info("Types generated successfully", { space });
    ui.ok(`Successfully generated types for space ${space}`, true);
    ui.br();
  } catch (error) {
    spinner.failed("Type generation failed");
    logger.error("Type generation failed", { error: error as Error });
    handleError(error as Error, verbose);
  }
});
