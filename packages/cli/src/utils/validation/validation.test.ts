import { describe, expect, it } from 'vitest';

import type { ValidationIssue } from './adapter';
import type { ValidationRunResult } from './types';
import { countIssues, filterIssuesByLevel } from './filter';
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
