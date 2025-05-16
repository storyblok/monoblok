#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const add_1 = require("./commands/add");
const pull_1 = require("./commands/pull");
const rebuild_1 = require("./commands/rebuild");
const check_versions_1 = require("./commands/check-versions");
// Create the program
const program = new commander_1.Command();
// Set up CLI metadata
program
    .name('monoblok')
    .description('CLI tool for managing subtrees in the monoblok monorepo')
    .version('0.1.0');
// Register commands
(0, add_1.addCommand)(program);
(0, pull_1.pullCommand)(program);
(0, rebuild_1.rebuildCommand)(program);
(0, check_versions_1.checkVersionsCommand)(program);
// Add help text at the end
program.on('--help', () => {
    console.log();
    console.log(`Example usage:`);
    console.log(`  ${chalk_1.default.green('monoblok add')}              - Add all subtrees defined in the manifest`);
    console.log(`  ${chalk_1.default.green('monoblok add storyblok-js')} - Add a specific subtree`);
    console.log(`  ${chalk_1.default.green('monoblok pull')}             - Pull updates for all subtrees`);
    console.log(`  ${chalk_1.default.green('monoblok rebuild storyblok-js')} - Rebuild a specific subtree`);
    console.log(`  ${chalk_1.default.green('monoblok check-versions')}   - Check for consistent pnpm version across packages`);
    console.log(`  ${chalk_1.default.green('monoblok check-versions --fix')} - Fix inconsistent pnpm versions`);
});
// Parse command line arguments
program.parse();
