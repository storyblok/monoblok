import type { Command } from "commander";
import { colorPalette, commands } from "../../constants";
import { CommandError, handleError, requireAuthentication } from "../../utils";
import { getProgram } from "../../program";
import { session } from "../../session";
import { fetchLanguages, saveLanguagesToFile } from "./actions";
import chalk from "chalk";
import type { PullLanguagesOptions } from "./constants";
import { isAbsolute, join, relative } from "pathe";
import { resolveCommandPath } from "../../utils/filesystem";
import { getUI } from "../../lib/ui";

const program = getProgram(); // Get the shared singleton instance

export const languagesCommand = program
  .command(commands.LANGUAGES)
  .alias("lang")
  .description(`Manage your space's languages`);

const pullCmd = languagesCommand
  .command("pull")
  .description(`Download your space's languages schema as json`)
  .option("-f, --filename <filename>", "filename to save the file as <filename>.<suffix>.json")
  .option(
    "--su, --suffix <suffix>",
    "suffix to add to the file name (e.g. languages.<suffix>.json). By default, the space ID is used.",
  )
  .option("-s, --space <space>", "space ID");

pullCmd.action(async (options: PullLanguagesOptions, command: Command) => {
  const ui = getUI();
  ui.title(`${commands.LANGUAGES}`, colorPalette.LANGUAGES);

  const { space, path, verbose } = command.optsWithGlobals();
  const { filename = "languages", suffix = options.space } = options;

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

  const spinner = ui.createSpinner(`Fetching ${chalk.hex(colorPalette.LANGUAGES)("languages")}`);
  try {
    const internationalization = await fetchLanguages(space);

    if (!internationalization || internationalization.languages?.length === 0) {
      spinner.failed();

      ui.warn(`No languages found in the space ${space}`, true);
      ui.br();
      return;
    }
    await saveLanguagesToFile(space, internationalization, {
      ...options,
      path,
      filename,
      suffix,
    });
    const languagesOutputDir = resolveCommandPath("languages", space, path);
    const fileName = suffix ? `${filename}.${suffix}.json` : `${filename}.json`;
    const filePath = join(languagesOutputDir, fileName);
    const displayPath = path && isAbsolute(path) ? filePath : relative(process.cwd(), filePath);
    spinner.succeed();
    ui.ok(
      `Languages schema downloaded successfully at ${chalk.hex(colorPalette.PRIMARY)(displayPath)}`,
      true,
    );
  } catch (error) {
    spinner.failed();
    ui.br();
    handleError(error as Error, verbose);
  }
  ui.br();
});
