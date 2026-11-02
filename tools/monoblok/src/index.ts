import { Command } from "commander";
import { subtreeCommand } from "./commands/subtree";
import { licenseCommand } from "./commands/license";
import { sizeCommand } from "./commands/size";

// Create the program
const program = new Command();

// Set up CLI metadata
program
  .name("monoblok")
  .description("CLI tool for managing the monoblok monorepo")
  .version("0.1.0");

// Register commands
subtreeCommand(program);
licenseCommand(program);
sizeCommand(program);

// Parse command line arguments
program.parse();
