#!/usr/bin/env node
import { cp, mkdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface SkillMapping {
  command: string;
  skill: string;
}

const skillMappings: SkillMapping[] = [
  { command: 'mapi-stories', skill: 'sb-mcp-mapi-stories' },
];

const [commandName, targetPath] = process.argv.slice(2);

if (!commandName || commandName === '-h' || commandName === '--help') {
  const availableCommands = skillMappings.map(mapping => mapping.command).join(', ');
  process.stdout.write(
    `${[
      'Usage:',
      '  sb-copy-skill COMMAND [path]',
      '',
      'Available commands:',
      `  ${availableCommands || '(none)'}`,
    ].join('\n')}\n`,
  );
  process.exit(0);
}

const mapping = skillMappings.find(entry => entry.command === commandName);

if (!mapping) {
  const availableCommands = skillMappings.map(entry => entry.command).join(', ');
  console.error(
    [
      `Unknown command: ${commandName}`,
      'Use one of:',
      `  ${availableCommands || '(none)'}`,
    ].join('\n'),
  );
  process.exit(1);
}

const baseDir = fileURLToPath(new URL('.', import.meta.url));
const skillsRoot = resolve(baseDir, 'skills');
const sourceDir = resolve(skillsRoot, mapping.skill);
const targetRoot = targetPath ? resolve(process.cwd(), targetPath) : process.cwd();
const targetSkillsDir = resolve(targetRoot, '.claude', 'skills', mapping.skill);

await stat(sourceDir);
await mkdir(targetSkillsDir, { recursive: true });
await cp(sourceDir, targetSkillsDir, { recursive: true });

process.stdout.write(`Copied ${mapping.skill} to ${targetSkillsDir}\n`);
