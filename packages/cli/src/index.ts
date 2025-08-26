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
import { mapiClient } from './api';

export * from './types/storyblok';

dotenv.config(); // This will load variables from .env into process.env
const program = getProgram();

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

program.command('test')
  .description('Run tests')
  .action(async () => {
    mapiClient({
      token: {
        accessToken: 'valid-token',
      },
      region: 'eu',
    });

    const client1 = mapiClient({
      token: {
        accessToken: 'invalid-token',
      },
      region: 'us',
    });

    console.log('Client 1:', client1);
  });

try {
  program.parse(process.argv);
}
catch (error) {
  handleError(error as Error);
}
