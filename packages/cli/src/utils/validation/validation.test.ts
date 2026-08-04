import { describe, expect, it } from 'vitest';

import type { ValidationIssue } from './adapter';
import type { ValidationRunResult } from './types';
import { parseFormat, parseLevel } from './types';
import { countIssues, filterIssuesByLevel } from './filter';
import { formatJson } from './format-json';
import { formatPretty } from './format-pretty';
import { entityToHeader, groupIssuesByEntity } from './group';

const error: ValidationIssue = {
  severity: 'error',
  code: 'unresolved_allow',
  path: ['blocks', 'hero', 'body', 'allow'],
  entity: 'block:hero',
  message: 'Field "body" allows unknown block "gallery".',
};

const warning: ValidationIssue = {
  severity: 'warning',
  code: 'unknown_field',
  path: ['content', 'legacy_cta'],
  entity: 'block:hero',
  message: 'Unknown field "legacy_cta" on component "hero".',
};

describe('filterIssuesByLevel', () => {
  it('should pass through everything at the warning threshold', () => {
    expect(filterIssuesByLevel([error, warning], 'warning')).toHaveLength(2);
  });

  it('should drop warnings at the error threshold', () => {
    expect(filterIssuesByLevel([error, warning], 'error')).toEqual([error]);
  });
});

describe('entityToHeader', () => {
  it('should format typed entities as "name (type)"', () => {
    expect(entityToHeader('block:hero')).toBe('hero (block)');
    expect(entityToHeader('datasource:colors')).toBe('colors (datasource)');
  });

  it('should leave bare entities untouched', () => {
    expect(entityToHeader('schema')).toBe('schema');
  });

  it('should not render a blank header for an entity with no name', () => {
    expect(entityToHeader('block:')).toBe('<unnamed block>');
  });
});

describe('groupIssuesByEntity', () => {
  it('should group issues by entity in first-seen order', () => {
    const other: ValidationIssue = { ...error, entity: 'block:page' };
    const groups = groupIssuesByEntity([error, other, warning]);
    expect(groups.map(g => g.header)).toEqual(['hero (block)', 'page (block)']);
    expect(groups[0].issues).toHaveLength(2);
  });
});

describe('countIssues', () => {
  it('should count errors, warnings, and units with issues', () => {
    const result: ValidationRunResult = {
      unitNoun: 'entities',
      unitsTotal: 14,
      groups: [{ header: 'hero (block)', issues: [error, warning] }],
    };
    expect(countIssues(result)).toEqual({ errors: 1, warnings: 1, unitsWithIssues: 1 });
  });
});

describe('formatPretty', () => {
  const result: ValidationRunResult = {
    unitNoun: 'entities',
    unitsTotal: 14,
    groups: [{ header: 'hero (block)', issues: [error, warning] }],
  };

  it('should render group headers, issue lines, and a true-total summary', () => {
    const output = formatPretty(result, 'warning');
    expect(output).toContain('hero (block)');
    expect(output).toContain('unresolved_allow');
    expect(output).toContain('blocks.hero.body.allow: Field "body" allows unknown block "gallery".');
    expect(output).toContain('unknown_field');
    expect(output).toContain('1 error, 1 warning across 1 of 14 entities');
  });

  it('should hide warnings at the error threshold but keep true totals in the summary', () => {
    const output = formatPretty(result, 'error');
    expect(output).not.toContain('unknown_field');
    expect(output).toContain('1 error, 1 warning across 1 of 14 entities');
  });

  it('should report a clean run', () => {
    const clean: ValidationRunResult = { unitNoun: 'entities', unitsTotal: 14, groups: [] };
    expect(formatPretty(clean, 'warning')).toContain('0 errors, 0 warnings across 0 of 14 entities');
  });
});

describe('parseLevel / parseFormat', () => {
  it('should accept the documented values', () => {
    expect(parseLevel('error')).toBe('error');
    expect(parseLevel('warning')).toBe('warning');
    expect(parseFormat('pretty')).toBe('pretty');
    expect(parseFormat('json')).toBe('json');
  });

  it('should throw a CommandError so a bad value exits 2, not commander\'s 1', () => {
    expect(() => parseLevel('bogus')).toThrow(/Invalid --level "bogus"/);
    expect(() => parseFormat('yaml')).toThrow(/Invalid --format "yaml"/);
  });
});

describe('formatJson', () => {
  const result: ValidationRunResult = {
    unitNoun: 'entities',
    unitsTotal: 14,
    groups: [{ header: 'hero (block)', issues: [error, warning] }],
  };

  it('should emit parseable JSON with true totals and ok:false on errors', () => {
    const report = JSON.parse(formatJson(result, 'warning'));
    expect(report).toMatchObject({
      ok: false,
      unit: 'entities',
      unitsTotal: 14,
      unitsWithIssues: 1,
      errors: 1,
      warnings: 1,
      fetchFailures: 0,
      listFailed: false,
    });
    expect(report.groups[0].issues).toHaveLength(2);
  });

  it('should apply the level filter to groups but keep true totals', () => {
    const report = JSON.parse(formatJson(result, 'error'));
    expect(report.groups[0].issues.map((issue: ValidationIssue) => issue.code)).toEqual(['unresolved_allow']);
    expect(report).toMatchObject({ errors: 1, warnings: 1 });
  });

  it('should drop groups left empty by the level filter', () => {
    const warningsOnly: ValidationRunResult = {
      unitNoun: 'stories',
      unitsTotal: 3,
      groups: [{ header: 'home (story #1)', issues: [warning] }],
    };
    const report = JSON.parse(formatJson(warningsOnly, 'error'));
    expect(report.groups).toEqual([]);
    // Warnings alone keep the run ok.
    expect(report.ok).toBe(true);
  });

  it('should report ok:false for a clean run that failed to list', () => {
    const incomplete: ValidationRunResult = {
      unitNoun: 'stories',
      unitsTotal: 0,
      groups: [],
      listFailed: true,
    };
    expect(JSON.parse(formatJson(incomplete, 'warning'))).toMatchObject({ ok: false, listFailed: true });
  });

  it('should report ok:false for a clean run with unfetched stories', () => {
    const incomplete: ValidationRunResult = {
      unitNoun: 'stories',
      unitsTotal: 5,
      groups: [],
      fetchFailures: 2,
    };
    expect(JSON.parse(formatJson(incomplete, 'warning'))).toMatchObject({ ok: false, fetchFailures: 2 });
  });

  it('should report ok:true for a complete clean run', () => {
    const clean: ValidationRunResult = { unitNoun: 'stories', unitsTotal: 5, groups: [], fetchFailures: 0 };
    expect(JSON.parse(formatJson(clean, 'warning'))).toMatchObject({ ok: true });
  });
});
