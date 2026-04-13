import { describe, expect, it } from 'vitest';
import { vol } from 'memfs';

import { renderMigrationCode, writeMigrationFile } from './generate';
import type { BreakingChange } from './types';

describe('renderMigrationCode', () => {
  it('should generate rename code', () => {
    const changes: BreakingChange[] = [
      { kind: 'rename', field: 'author', oldField: 'author_name' },
    ];
    const code = renderMigrationCode(changes);
    expect(code).toContain('block.author = block.author_name');
    expect(code).toContain('delete block.author_name');
    expect(code).toContain('export default function');
    expect(code).toContain('return block');
  });

  it('should generate removal code', () => {
    const changes: BreakingChange[] = [{ kind: 'removed', field: 'subtitle' }];
    const code = renderMigrationCode(changes);
    expect(code).toContain('delete block.subtitle');
  });

  it('should generate type conversion for text to number', () => {
    const changes: BreakingChange[] = [
      { kind: 'type_changed', field: 'rating', oldType: 'text', newType: 'number' },
    ];
    const code = renderMigrationCode(changes);
    expect(code).toContain('Number(block.rating)');
  });

  it('should generate type conversion for text to boolean', () => {
    const changes: BreakingChange[] = [
      { kind: 'type_changed', field: 'active', oldType: 'text', newType: 'boolean' },
    ];
    const code = renderMigrationCode(changes);
    expect(code).toContain('!!block.active');
  });

  it('should generate type conversion for number to text', () => {
    const changes: BreakingChange[] = [
      { kind: 'type_changed', field: 'count', oldType: 'number', newType: 'text' },
    ];
    const code = renderMigrationCode(changes);
    expect(code).toContain('String(block.count)');
  });

  it('should generate TODO comment for unknown type conversions', () => {
    const changes: BreakingChange[] = [
      { kind: 'type_changed', field: 'content', oldType: 'text', newType: 'bloks' },
    ];
    const code = renderMigrationCode(changes);
    expect(code).toContain('TODO');
    expect(code).toContain('text');
    expect(code).toContain('bloks');
  });

  it('should skip text-textarea conversions as compatible', () => {
    const changes: BreakingChange[] = [
      { kind: 'type_changed', field: 'body', oldType: 'text', newType: 'textarea' },
    ];
    const code = renderMigrationCode(changes);
    expect(code).not.toContain('TODO');
    expect(code).toContain('return block');
  });

  it('should generate required_added with string default for text field', () => {
    const changes: BreakingChange[] = [{ kind: 'required_added', field: 'cta_label', fieldType: 'text' }];
    const code = renderMigrationCode(changes);
    expect(code).toContain('TODO');
    expect(code).toContain('default value');
    expect(code).toContain('block.cta_label = block.cta_label ?? \'\'');
  });

  it('should generate required_added with numeric default for number field', () => {
    const changes: BreakingChange[] = [{ kind: 'required_added', field: 'count', fieldType: 'number' }];
    const code = renderMigrationCode(changes);
    expect(code).toContain('block.count = block.count ?? 0');
  });

  it('should generate required_added with commented-out placeholder for complex types', () => {
    const changes: BreakingChange[] = [{ kind: 'required_added', field: 'image', fieldType: 'asset' }];
    const code = renderMigrationCode(changes);
    expect(code).toContain('TODO: provide a default value appropriate for the \'asset\' type');
    expect(code).toContain('// block.image = block.image ?? <default>');
    expect(code).not.toMatch(/^\s+block\.image\s*=/m);
  });

  it('should generate rename hint comment for declined renames', () => {
    const changes: BreakingChange[] = [
      { kind: 'removed', field: 'author_name', renameHint: { newField: 'author' } },
    ];
    const code = renderMigrationCode(changes);
    expect(code).toContain('// If \'author_name\' was renamed to \'author\', uncomment:');
    expect(code).toContain('// block.author = block.author_name;');
    expect(code).toContain('delete block.author_name');
  });

  it('should combine multiple changes in one file', () => {
    const changes: BreakingChange[] = [
      { kind: 'rename', field: 'author', oldField: 'author_name' },
      { kind: 'type_changed', field: 'rating', oldType: 'text', newType: 'number' },
      { kind: 'removed', field: 'subtitle' },
    ];
    const code = renderMigrationCode(changes);
    expect(code).toContain('block.author = block.author_name');
    expect(code).toContain('Number(block.rating)');
    expect(code).toContain('delete block.subtitle');
  });

  it('should generate string default for text field becoming required', () => {
    const changes: BreakingChange[] = [
      { kind: 'required_changed', field: 'title', fieldType: 'text' },
    ];
    const code = renderMigrationCode(changes);
    expect(code).toContain('block.title = block.title ?? \'\'');
    expect(code).toContain('TODO');
  });

  it('should generate numeric default for number field becoming required', () => {
    const changes: BreakingChange[] = [
      { kind: 'required_changed', field: 'count', fieldType: 'number' },
    ];
    const code = renderMigrationCode(changes);
    expect(code).toContain('block.count = block.count ?? 0');
  });

  it('should generate boolean default for boolean field becoming required', () => {
    const changes: BreakingChange[] = [
      { kind: 'required_changed', field: 'active', fieldType: 'boolean' },
    ];
    const code = renderMigrationCode(changes);
    expect(code).toContain('block.active = block.active ?? false');
  });

  it('should generate commented-out placeholder for complex field types becoming required', () => {
    const changes: BreakingChange[] = [
      { kind: 'required_changed', field: 'image', fieldType: 'asset' },
    ];
    const code = renderMigrationCode(changes);
    expect(code).toContain('TODO: provide a default value appropriate for the \'asset\' type');
    expect(code).toContain('// block.image = block.image ?? <default>');
    // Must NOT contain an uncommented assignment
    expect(code).not.toMatch(/^\s+block\.image\s*=/m);
  });
});

describe('writeMigrationFile', () => {
  it('should write migration file with timestamp suffix', async () => {
    const code = 'export default function (block) {\n  return block;\n}\n';
    const timestamp = '2026-04-10T12:00:00.000Z';

    const path = await writeMigrationFile({
      spaceId: '12345',
      componentName: 'hero',
      code,
      timestamp,
    });

    expect(path).toContain('migrations/12345/hero.2026-04-10T12-00-00-000Z.js');
    const files = vol.toJSON();
    expect(Object.keys(files).some(f => f.includes('hero.2026-04-10T12-00-00-000Z.js'))).toBe(true);
  });

  it('should use custom base path when provided', async () => {
    const code = 'export default function (block) {\n  return block;\n}\n';
    const timestamp = '2026-04-10T12:00:00.000Z';

    const path = await writeMigrationFile({
      spaceId: '12345',
      componentName: 'hero',
      code,
      timestamp,
      basePath: 'custom/path',
    });

    expect(path).toContain('custom/path/migrations/12345/hero.2026-04-10T12-00-00-000Z.js');
  });
});
