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

let executionError: Error | undefined;

try {
  // Add before-command hook before parsing
  await pluginManager.runLifecycleHook('before-command', { args: process.argv });

  program.parse(process.argv);

  // Run after-command hook on successful execution
  await pluginManager.runLifecycleHook('after-command', { args: process.argv });
}
catch (error) {
  executionError = error as Error;

  // Run on-error hook when command fails
  await pluginManager.runLifecycleHook('on-error', {
    error: executionError,
    args: process.argv,
  });

  handleError(error as Error);
}
finally {
  // Run teardown hook for cleanup
  await pluginManager.runLifecycleHook('teardown', {
    error: executionError,
    args: process.argv,
  });
}
