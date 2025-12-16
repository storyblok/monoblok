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
import './commands/logs';
import './commands/reports';
import './commands/assets';
import './commands/stories';

import { colorPalette } from './constants';

export * from './types/storyblok';

const program = getProgram();

konsola.br();
konsola.br();
konsola.title(` Storyblok CLI `, colorPalette.PRIMARY);

// Handle invalid commands
program.on('command:*', () => {
  console.error(`Invalid command: ${program.args.join(' ')}`);
  konsola.br();
  program.outputHelp();
  process.exit(1);
});

try {
  program.parse(process.argv);
}
catch (error) {
  handleError(error as Error);
}
