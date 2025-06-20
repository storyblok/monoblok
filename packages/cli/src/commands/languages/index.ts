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
  .command('languages')
  .alias('lang')
  .description(`Manage your space's languages`)
  .option('-s, --space <space>', 'space ID')
  .option('-p, --path <path>', 'path to save the file. Default is .storyblok/languages');

languagesCommand
  .command('pull')
  .description(`Download your space's languages schema as json`)
  .option('-f, --filename <filename>', 'filename to save the file as <filename>.<suffix>.json')
  .option('--su, --suffix <suffix>', 'suffix to add to the file name (e.g. languages.<suffix>.json). By default, the space ID is used.')
  .action(async (options: PullLanguagesOptions) => {
    konsola.title(` ${commands.LANGUAGES} `, colorPalette.LANGUAGES);

    // Global options
    const verbose = program.opts().verbose;

    // Command options
    const { space, path } = languagesCommand.opts();
    const { filename = 'languages', suffix = options.space } = options;

    const { state, initializeSession } = session();
    await initializeSession();

    if (!requireAuthentication(state, verbose)) {
      return;
    }
    if (!space) {
      handleError(new CommandError(`Please provide the space as argument --space YOUR_SPACE_ID.`), verbose);
      return;
    }

    const { password, region } = state;

    const spinner = new Spinner({
      verbose: !isVitest,
    });
    try {
      spinner.start(`Fetching ${chalk.hex(colorPalette.LANGUAGES)('languages')}`);

      const internationalization = await fetchLanguages(space, password, region);

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
