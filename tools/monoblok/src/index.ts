#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { addCommand } from './commands/add';
import { pullCommand } from './commands/pull';
import { rebuildCommand } from './commands/rebuild';

// Create the program
const program = new Command();

// Set up CLI metadata
program
  .name('monoblok')
  .description('CLI tool for managing subtrees in the monoblok monorepo')
  .version('0.1.0');

// Register commands
addCommand(program);
pullCommand(program);
rebuildCommand(program);

// Add help text at the end
program.on('--help', () => {
  console.log();
  console.log(`Example usage:`);
  console.log(`  ${chalk.green('monoblok add')}              - Add all subtrees defined in the manifest`);
  console.log(`  ${chalk.green('monoblok add storyblok-js')} - Add a specific subtree`);
  console.log(`  ${chalk.green('monoblok pull')}             - Pull updates for all subtrees`);
  console.log(`  ${chalk.green('monoblok rebuild storyblok-js')} - Rebuild a specific subtree`);
});

// Parse command line arguments
program.parse(); 
