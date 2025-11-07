#!/usr/bin/env node
import 'dotenv/config';

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
import { applyConfigToCommander, getCommandAncestry, GLOBAL_OPTION_DEFINITIONS, logActiveConfig, resolveConfig, setActiveConfig } from './config';

export * from './types/storyblok';

const program = getProgram();

konsola.br();
konsola.br();
konsola.title(` Storyblok CLI `, colorPalette.PRIMARY);

program.option('--verbose', 'Enable verbose output', false);

// Set all the global config options
for (const option of GLOBAL_OPTION_DEFINITIONS) {
  if (option.parser) {
    program.option(option.flags, option.description, option.parser, option.defaultValue);
  }
  else {
    program.option(option.flags, option.description, option.defaultValue);
  }
}

program.version(pkg.version, '-v, --vers', 'Output the current version');
program.helpOption('-h, --help', 'Display help for command');

program.on('command:*', () => {
  console.error(`Invalid command: ${program.args.join(' ')}`);
  konsola.br();
  program.outputHelp();
  process.exit(1);
});

// Resolve and hydrate the config
program.hook('preAction', async (thisCommand, actionCommand) => {
  const targetCommand = actionCommand ?? thisCommand;
  const ancestry = getCommandAncestry(targetCommand); // builds up hierarchy
  const resolved = await resolveConfig(targetCommand, ancestry);
  applyConfigToCommander(ancestry, resolved);
  setActiveConfig(resolved);
  logActiveConfig(resolved, ancestry, resolved.verbose);
});

try {
  program.parse(process.argv);
}
catch (error) {
  handleError(error as Error);
}
