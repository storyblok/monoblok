#!/usr/bin/env node
import dotenv from 'dotenv';
import { loadConfig } from 'c12';

import { handleError, konsola } from './utils';
import { getProgram } from './program';
import './commands/login';
import './commands/logout';
import './commands/signup';
import './commands/user';
import './commands/components';
import './commands/languages';
import './commands/migrations';
import './commands/types';
import './commands/datasources';
import './commands/create';
import pkg from '../package.json';

import { colorPalette } from './constants';
import { resolveConfig } from './utils/config';

export * from './types/storyblok';

dotenv.config(); // This will load variables from .env into process.env
const program = getProgram();

konsola.br();
konsola.br();
konsola.title(` Storyblok CLI `, colorPalette.PRIMARY);

program.option('--verbose', 'Enable verbose output', false);
program.version(pkg.version, '-v, --vers', 'Output the current version');
program.helpOption('-h, --help', 'Display help for command');

program.on('command:*', () => {
  console.error(`Invalid command: ${program.args.join(' ')}`);
  konsola.br();
  program.outputHelp();
  process.exit(1);
});

program.command('test')
  .description('Test command')
  .option('--verbose', 'Enable verbose output')
  .option('--region <region>', 'Specify region')
  .hook('preAction', resolveConfig)
  .action(async (options, thisCommand) => {
    const config = await loadConfig({
      name: 'storyblok',
    });
    console.log('Loaded config:', config.config);
    console.log('Command options after config resolution:', thisCommand.opts());
    console.log('Final verbose value:', thisCommand.opts().verbose);
    console.log('Final region value:', thisCommand.opts().region);
  });

try {
  program.parse(process.argv);
}
catch (error) {
  handleError(error as Error);
}
