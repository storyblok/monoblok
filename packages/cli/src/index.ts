#!/usr/bin/env node
import dotenv from 'dotenv';

import { handleError, konsola } from './utils';
import { getProgram } from './program';
import { initializePluginSystem, PluginManager } from './plugins';
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
import './commands/plugins';
import pkg from '../package.json';

import { colorPalette } from './constants';

export * from './types/storyblok';

dotenv.config(); // This will load variables from .env into process.env
const program = getProgram();

await initializePluginSystem();

// Run init hooks after plugin system is initialized
const pluginManager = PluginManager.getInstance();
await pluginManager.runLifecycleHook('init');

konsola.br();
konsola.br();
konsola.title(` Storyblok CLI `, colorPalette.PRIMARY);

program.option('--verbose', 'Enable verbose output');
program.version(pkg.version, '-v, --vers', 'Output the current version');
program.helpOption('-h, --help', 'Display help for command');

program.on('command:*', () => {
  console.error(`Invalid command: ${program.args.join(' ')}`);
  konsola.br();
  program.outputHelp();
  process.exit(1);
});

let success = true;
let executionError: Error | undefined;

try {
  // Add preRun hook before parsing
  await pluginManager.runLifecycleHook('preRun', { args: process.argv });

  program.parse(process.argv);
}
catch (error) {
  success = false;
  executionError = error as Error;
  handleError(error as Error);
}
finally {
  // Always run postRun hook with success/failure context
  await pluginManager.runLifecycleHook('postRun', {
    success,
    error: executionError,
  });
}
