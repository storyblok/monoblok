import { describe, expect, it } from 'vitest';

import type { DiffResult, EntityDiff } from '../types';
import { buildDiffReport, formatSchemaDiff, isSpaceRef } from './actions';

function makeResult(diffs: EntityDiff[]): DiffResult {
  return {
    diffs,
    creates: diffs.filter(d => d.action === 'create').length,
    updates: diffs.filter(d => d.action === 'update').length,
    unchanged: diffs.filter(d => d.action === 'unchanged').length,
    stale: diffs.filter(d => d.action === 'stale').length,
  };
}

describe('isSpaceRef', () => {
  it('should treat a numeric string as a space ID', () => {
    expect(isSpaceRef('12345')).toBe(true);
    expect(isSpaceRef('  678 ')).toBe(true);
  });

  it('should treat a non-numeric string as a file path', () => {
    expect(isSpaceRef('./schema.ts')).toBe(false);
    expect(isSpaceRef('src/schema/index.ts')).toBe(false);
    expect(isSpaceRef('12/schema.ts')).toBe(false);
  });
});

describe('buildDiffReport', () => {
  it('should carry the summary counts and full entity list', () => {
    const result = makeResult([
      { type: 'component', name: 'hero', action: 'create', changes: [], before: null, after: { name: 'hero' } },
      { type: 'component', name: 'footer', action: 'stale', changes: [], before: { name: 'footer' }, after: null },
    ]);

    const report = buildDiffReport(result, '111', '222');

    expect(report.from).toBe('111');
    expect(report.to).toBe('222');
    expect(report.summary).toEqual({ create: 1, update: 0, unchanged: 0, stale: 1 });
    expect(report.entities).toHaveLength(2);
    expect(report.entities[0]).toMatchObject({ name: 'hero', action: 'create' });
  });
});

describe('formatSchemaDiff', () => {
  it('should use direction-aware wording (added/changed/removed)', () => {
    const result = makeResult([
      { type: 'component', name: 'hero', action: 'create', changes: [], before: null, after: { name: 'hero' } },
      {
        type: 'component',
        name: 'teaser',
        action: 'update',
        changes: [{ field: 'headline', change: 'modified', before: { type: 'text' }, after: { type: 'textarea' } }],
        before: {},
        after: {},
      },
      { type: 'datasource', name: 'colors', action: 'stale', changes: [], before: { name: 'colors' }, after: null },
    ]);

    const output = formatSchemaDiff(result, '111', '222');

    expect(output).toContain('from 111 → to 222');
    expect(output).toContain('hero (added)');
    expect(output).toContain('teaser (changed)');
    expect(output).toContain('colors (removed)');
    expect(output).toContain('headline');
    expect(output).toContain('1 added, 1 changed, 1 removed');
  });

  it('should report no differences when nothing changed', () => {
    const result = makeResult([
      { type: 'component', name: 'hero', action: 'unchanged', changes: [], before: {}, after: {} },
    ]);

    const output = formatSchemaDiff(result, 'a.ts', 'b.ts');

    expect(output).toContain('1 unchanged');
  });

  it('should omit unchanged entities from the listing while keeping the summary count', () => {
    const result = makeResult([
      { type: 'component', name: 'hero', action: 'create', changes: [], before: null, after: { name: 'hero' } },
      { type: 'component', name: 'footer', action: 'unchanged', changes: [], before: {}, after: {} },
    ]);

    const output = formatSchemaDiff(result, '111', '222');

    expect(output).toContain('hero (added)');
    expect(output).not.toContain('footer');
    expect(output).not.toContain('(unchanged)');
    expect(output).toContain('1 unchanged');
  });
});
