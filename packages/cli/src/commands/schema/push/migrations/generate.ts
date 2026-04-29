import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'pathe';

import { resolvePath } from '../../../../utils/filesystem';
import type { BreakingChange } from './types';

/** Compatible type pairs that don't need a content migration. */
const COMPATIBLE_TYPES = new Set(['text:textarea', 'textarea:text']);

/** Returns a safe default literal for a Storyblok field type, or null if no safe default exists. */
function defaultForType(fieldType: string): string | null {
  switch (fieldType) {
    case 'text':
    case 'textarea':
    case 'markdown': return `''`;
    case 'number': return '0';
    case 'boolean': return 'false';
    default: return null;
  }
}

/** Returns a conversion expression for a type change, or null if compatible. */
function typeConversion(field: string, oldType: string, newType: string): string | null {
  const key = `${oldType}:${newType}`;
  if (COMPATIBLE_TYPES.has(key)) { return null; }

  const accessor = `block.${field}`;
  switch (key) {
    case 'text:number': return `${accessor} = Number(${accessor}) || 0;`;
    case 'number:text': return `${accessor} = String(${accessor});`;
    case 'text:boolean': return `${accessor} = !!${accessor};`;
    case 'boolean:text': return `${accessor} = String(${accessor});`;
    default: return `${accessor}; // TODO: convert from ${oldType} to ${newType}`;
  }
}

/**
 * Renders a migration function body from a list of breaking changes.
 * Returns a complete migration file content string.
 */
export function renderMigrationCode(changes: BreakingChange[]): string {
  const lines: string[] = [];

  lines.push('  // Review this migration before running it against your space.');
  lines.push('  // Generated migrations are scaffolds and may need manual adjustments.');
  lines.push('  // Example rename migration:');
  lines.push('  // block.new_field = block.old_field;');
  lines.push('  // delete block.old_field;');
  lines.push('');

  for (const change of changes) {
    switch (change.kind) {
      case 'rename':
        lines.push(`  // Rename: ${change.oldField} → ${change.field}`);
        lines.push(`  if ('${change.oldField}' in block) {`);
        lines.push(`    block.${change.field} = block.${change.oldField};`);
        lines.push(`    delete block.${change.oldField};`);
        lines.push(`  }`);
        break;

      case 'removed':
        if (change.renameHint) {
          lines.push(`  // If '${change.field}' was renamed to '${change.renameHint.newField}', uncomment:`);
          lines.push(`  // block.${change.renameHint.newField} = block.${change.field};`);
        }
        else {
          lines.push(`  // Removed field: ${change.field}`);
        }
        lines.push(`  delete block.${change.field};`);
        break;

      case 'type_changed': {
        const conversion = typeConversion(change.field, change.oldType, change.newType);
        if (conversion) {
          lines.push(`  // Type change: ${change.field} (${change.oldType} → ${change.newType})`);
          lines.push(`  ${conversion}`);
        }
        break;
      }

      case 'required_added': {
        const defaultValue = defaultForType(change.fieldType);
        lines.push(`  // New required field: ${change.field} (${change.fieldType})`);
        if (defaultValue !== null) {
          lines.push(`  // TODO: provide a meaningful default value`);
          lines.push(`  block.${change.field} = block.${change.field} ?? ${defaultValue};`);
        }
        else {
          lines.push(`  // TODO: provide a default value appropriate for the '${change.fieldType}' type`);
          lines.push(`  // block.${change.field} = block.${change.field} ?? <default>;`);
        }
        break;
      }

      case 'required_changed': {
        const defaultValue = defaultForType(change.fieldType);
        lines.push(`  // Field is now required: ${change.field} (${change.fieldType})`);
        lines.push(`  // Existing stories may have null/undefined values — provide a default for those.`);
        if (defaultValue !== null) {
          lines.push(`  // TODO: provide a meaningful default value`);
          lines.push(`  block.${change.field} = block.${change.field} ?? ${defaultValue};`);
        }
        else {
          lines.push(`  // TODO: provide a default value appropriate for the '${change.fieldType}' type`);
          lines.push(`  // block.${change.field} = block.${change.field} ?? <default>;`);
        }
        break;
      }
    }

    lines.push('');
  }

  const body = lines.length > 0 ? `\n${lines.join('\n')}` : '\n';

  return `export default function (block) {${body}  return block;\n}\n`;
}

/** Converts an ISO timestamp to a filesystem-safe string. */
function fileTimestamp(iso: string): string {
  return iso.replace(/[:.]/g, '-');
}

/** Options for writing a migration file. */
export interface WriteMigrationFileOptions {
  spaceId: string;
  componentName: string;
  code: string;
  timestamp: string;
  basePath?: string;
}

/**
 * Writes a migration file to disk.
 * @returns The absolute path to the written file.
 */
export async function writeMigrationFile(options: WriteMigrationFileOptions): Promise<string> {
  const { spaceId, componentName, code, timestamp, basePath } = options;
  const dir = resolvePath(basePath, `migrations/${spaceId}`);
  await mkdir(dir, { recursive: true });
  const fileName = `${componentName}.${fileTimestamp(timestamp)}.js`;
  const filePath = join(dir, fileName);
  await writeFile(filePath, code, 'utf-8');
  return filePath;
}
