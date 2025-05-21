import { Command } from 'commander';
import { checkCommand } from './check';

export function licenseCommand(program: Command): void {
  const license = program
    .command('license')
    .description('Manage and check package licenses');

  // Add license-related subcommands
  checkCommand(license);
} 
