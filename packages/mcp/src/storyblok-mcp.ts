#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { makeMCP } from './factory.js';

const command = process.argv[2];
const baseDir = fileURLToPath(new URL('.', import.meta.url));
const mapiDir = resolve(baseDir, '..', 'node_modules/@storyblok/openapi/dist/mapi');

interface CommandEntry { type: 'module' | 'yaml'; entry: string }

const commands = new Map<string, CommandEntry>([
  ['copy-skill', { type: 'module', entry: './copy-skill.js' }],
  ['mapi-asset-folders', { type: 'yaml', entry: 'asset-folders.yaml' }],
  ['mapi-assets', { type: 'yaml', entry: 'assets.yaml' }],
  ['mapi-component-folders', { type: 'yaml', entry: 'component-folders.yaml' }],
  ['mapi-components', { type: 'yaml', entry: 'components.yaml' }],
  ['mapi-datasource-entries', { type: 'yaml', entry: 'datasource-entries.yaml' }],
  ['mapi-datasources', { type: 'yaml', entry: 'datasources.yaml' }],
  ['mapi-internal-tags', { type: 'yaml', entry: 'internal-tags.yaml' }],
  ['mapi-presets', { type: 'yaml', entry: 'presets.yaml' }],
  ['mapi-spaces', { type: 'yaml', entry: 'spaces.yaml' }],
  ['mapi-stories', { type: 'yaml', entry: 'stories.yaml' }],
  ['mapi-users', { type: 'yaml', entry: 'users.yaml' }],
]);

function printHelp(): void {
  const available = Array.from(commands.keys())
    .map(name => `  - ${name}`)
    .join('\n');

  console.error('Usage: storyblok-mcp <command>');
  console.error('');
  console.error('Commands:');
  console.error(available);
}

if (!command || command === 'help' || command === '--help' || command === '-h') {
  printHelp();
  process.exitCode = 1;
}
else {
  const entry = commands.get(command);
  if (!entry) {
    console.error(`Unknown command: ${command}`);
    console.error('');
    printHelp();
    process.exitCode = 1;
  }
  else if (entry.type === 'module') {
    process.argv.splice(2, 1);
    await import(entry.entry);
  }
  else {
    const specContent = await readFile(resolve(mapiDir, entry.entry), { encoding: 'utf-8' });
    await makeMCP(specContent, {
      authToken: process.env.STORYBLOK_MCP_AUTH_TOKEN,
      space: process.env.STORYBLOK_MCP_SPACE,
    });
  }
}
