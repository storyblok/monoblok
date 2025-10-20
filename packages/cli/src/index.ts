#!/usr/bin/env node
import dotenv from 'dotenv';

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
program.option('--global-flag <global-flag>', 'Enable global flag', 'default');
program.version(pkg.version, '-v, --vers', 'Output the current version');
program.helpOption('-h, --help', 'Display help for command');

program.on('command:*', () => {
  console.error(`Invalid command: ${program.args.join(' ')}`);
  konsola.br();
  program.outputHelp();
  process.exit(1);
});

// TODO remove this before merging
program.command('test')
  .description('Test command')
  .option('--local-flag <local-flag>', 'Enable debug output', 'default')
  .option('--region <region>', 'Specify region')
  .action(async (options, thisCommand) => {
    const resolvedOpts = await resolveConfig(thisCommand);
    console.log('Resolved options:', resolvedOpts);
  });

const deepCommand = program.command('deep')
  .description('Deep command');

deepCommand.command('pull [componentName]')
  .description('Pull command')
  .option('--global-flag <global-flag>', 'Enable debug output')
  .option('-f, --filename <filename>', 'custom name to be used in file(s) name instead of space id')
  .option('--sf, --separate-files', 'Argument to create a single file for each component')
  .option('--su, --suffix <suffix>', 'suffix to add to the file name (e.g. components.<suffix>.json)')
  .action(async (componentName: string, options, thisCommand) => {
    const resolvedOpts = await resolveConfig(thisCommand);
    console.log('Resolved options:', resolvedOpts);
  });

try {
  program.parse(process.argv);
}
catch (error) {
  handleError(error as Error);
}
