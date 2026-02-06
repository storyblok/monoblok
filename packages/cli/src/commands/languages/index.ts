import type { Command } from 'commander';
import { colorPalette, commands } from '../../constants';
import { CommandError, handleError, isVitest, konsola, requireAuthentication } from '../../utils';
import { getProgram } from '../../program';
import { session } from '../../session';
import { fetchLanguages, saveLanguagesToFile } from './actions';
import chalk from 'chalk';
import type { PullLanguagesOptions } from './constants';
import { Spinner } from '@topcli/spinner';

const program = getProgram(); // Get the shared singleton instance

export const languagesCommand = program
  .command(commands.LANGUAGES)
  .alias('lang')
  .description(`Manage your space's languages`);

const pullCmd = languagesCommand
  .command('pull')
  .description(`Download your space's languages schema as json`)
  .option('-f, --filename <filename>', 'filename to save the file as <filename>.<suffix>.json')
  .option('--su, --suffix <suffix>', 'suffix to add to the file name (e.g. languages.<suffix>.json). By default, the space ID is used.')
  .option('-s, --space <space>', 'space ID')
  .option('-p, --path <path>', 'path for file storage');

pullCmd
  .action(async (options: PullLanguagesOptions, command: Command) => {
    konsola.title(`${commands.LANGUAGES}`, colorPalette.LANGUAGES);

    const { space, path, verbose } = command.optsWithGlobals();
    const { filename = 'languages', suffix = options.space } = options;

    const { state } = session();

    if (!requireAuthentication(state, verbose)) {
      return;
    }
    if (!space) {
      handleError(new CommandError(`Please provide the space as argument --space YOUR_SPACE_ID.`), verbose);
      return;
    }

    const spinner = new Spinner({
      verbose: !isVitest,
    });
    try {
      spinner.start(`Fetching ${chalk.hex(colorPalette.LANGUAGES)('languages')}`);

      const internationalization = await fetchLanguages(space);

      if (!internationalization || internationalization.languages?.length === 0) {
        spinner.failed();

        konsola.warn(`No languages found in the space ${space}`, true);
        konsola.br();
        return;
      }
      await saveLanguagesToFile(space, internationalization, {
        ...options,
        path,
      });
      const fileName = suffix ? `${filename}.${suffix}.json` : `${filename}.json`;
      const filePath = path ? `${path}/${fileName}` : `.storyblok/languages/${space}/${fileName}`;
      spinner.succeed();
      konsola.ok(`Languages schema downloaded successfully at ${chalk.hex(colorPalette.PRIMARY)(filePath)}`, true);
    }
    catch (error) {
      spinner.failed();
      konsola.br();
      handleError(error as Error, verbose);
    }
    konsola.br();
  });
