import { Command } from 'commander';
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

// Parse command line arguments
program.parse(); 
