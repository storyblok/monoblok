import { describe, expect, it } from 'vitest';

import type { Component, Story } from '../../../types';
import type { DiffResult } from '../types';
import type { ComponentBreakingChanges } from '../migrations/types';
import { toSchemaLike } from '../to-schema-like';
import {
  aggregate,
  analyzeStory,
  computeImpactedComponents,
  createAnalyzeContext,
  type ImpactedMap,
} from './actions';

function makeComponent(name: string, schema: Record<string, Record<string, unknown>>): Component {
  return { id: 1, name, created_at: '', updated_at: '', is_root: false, is_nestable: true, schema } as unknown as Component;
}

function makeStory(overrides: Partial<Story> & { content: unknown }): Story {
  return { id: 1, uuid: 'u', name: 'Story', full_slug: 'story', ...overrides } as unknown as Story;
}

describe('computeImpactedComponents', () => {
  const emptyDiff: DiffResult = { diffs: [], creates: 0, updates: 0, unchanged: 0, stale: 0 };

  it('should mark components with breaking changes as update', () => {
    const breaking: ComponentBreakingChanges[] = [
      { componentName: 'hero', changes: [{ kind: 'removed', field: 'subtitle' }] },
    ];
    const impacted = computeImpactedComponents(emptyDiff, breaking);

    expect(impacted.get('hero')).toMatchObject({ action: 'update' });
    expect(impacted.get('hero')?.fields[0]).toMatchObject({ field: 'subtitle', contentKey: 'subtitle', kind: 'removed' });
  });

  it('should mark stale components as removed only with withDelete', () => {
    const diff: DiffResult = {
      diffs: [{ type: 'component', name: 'teaser', action: 'stale', diff: null, local: null, remote: null }],
      creates: 0,
      updates: 0,
      unchanged: 0,
      stale: 1,
    };

    expect(computeImpactedComponents(diff, []).has('teaser')).toBe(false);
    expect(computeImpactedComponents(diff, [], { withDelete: true }).get('teaser'))
      .toMatchObject({ action: 'removed' });
  });

  it('should map a rename content key to the old field name', () => {
    const breaking: ComponentBreakingChanges[] = [
      { componentName: 'hero', changes: [{ kind: 'rename', field: 'headline', oldField: 'title' }] },
    ];
    const impacted = computeImpactedComponents(emptyDiff, breaking);

    expect(impacted.get('hero')?.fields[0]).toMatchObject({ field: 'headline', contentKey: 'title', kind: 'rename' });
  });
});

describe('analyzeStory', () => {
  it('should flag a removed field as a warning, not broken', () => {
    const oldSchema = toSchemaLike([makeComponent('hero', { title: { type: 'text' }, subtitle: { type: 'text' } })]);
    const newSchema = toSchemaLike([makeComponent('hero', { title: { type: 'text' } })]);
    const impacted: ImpactedMap = new Map([
      ['hero', { component: 'hero', action: 'update', fields: [{ field: 'subtitle', contentKey: 'subtitle', kind: 'removed' }] }],
    ]);
    const story = makeStory({ content: { _uid: 'r', component: 'hero', title: 'Hi', subtitle: 'gone' } });

    const result = analyzeStory(story, createAnalyzeContext(impacted, oldSchema, newSchema));

    expect(result?.components).toEqual(['hero']);
    expect(result?.broken).toBe(false);
    expect(result?.usedFields).toEqual([{ component: 'hero', field: 'subtitle' }]);
    expect(result?.issues.some(i => i.code === 'unknown_field' && i.severity === 'warning')).toBe(true);
  });

  it('should flag a newly required field as broken', () => {
    const oldSchema = toSchemaLike([makeComponent('hero', { title: { type: 'text' } })]);
    const newSchema = toSchemaLike([makeComponent('hero', { title: { type: 'text', required: true } })]);
    const impacted: ImpactedMap = new Map([
      ['hero', { component: 'hero', action: 'update', fields: [{ field: 'title', contentKey: 'title', kind: 'required_added' }] }],
    ]);
    const story = makeStory({ content: { _uid: 'r', component: 'hero' } });

    const result = analyzeStory(story, createAnalyzeContext(impacted, oldSchema, newSchema));

    expect(result?.broken).toBe(true);
    expect(result?.issues.some(i => i.component === 'hero' && i.field === 'title' && i.severity === 'error')).toBe(true);
  });

  it('should not count pre-existing errors as change-induced breakage', () => {
    // `title` is required in both schemas; the story already violates it, so the
    // analyzed change (adding required `subtitle`) must not blame `title`.
    const oldSchema = toSchemaLike([makeComponent('hero', { title: { type: 'text', required: true } })]);
    const newSchema = toSchemaLike([makeComponent('hero', { title: { type: 'text', required: true }, subtitle: { type: 'text' } })]);
    const impacted: ImpactedMap = new Map([
      ['hero', { component: 'hero', action: 'update', fields: [{ field: 'subtitle', contentKey: 'subtitle', kind: 'required_added' }] }],
    ]);
    const story = makeStory({ content: { _uid: 'r', component: 'hero' } });

    const result = analyzeStory(story, createAnalyzeContext(impacted, oldSchema, newSchema));

    expect(result?.broken).toBe(false);
    expect(result?.issues).toEqual([]);
  });

  it('should attribute a rename error to the renamed field', () => {
    const oldSchema = toSchemaLike([makeComponent('hero', { title: { type: 'text' } })]);
    const newSchema = toSchemaLike([makeComponent('hero', { headline: { type: 'text', required: true } })]);
    const impacted: ImpactedMap = new Map([
      ['hero', { component: 'hero', action: 'update', fields: [{ field: 'headline', contentKey: 'title', kind: 'rename' }] }],
    ]);
    const story = makeStory({ content: { _uid: 'r', component: 'hero', title: 'Hi' } });

    const result = analyzeStory(story, createAnalyzeContext(impacted, oldSchema, newSchema));

    expect(result?.broken).toBe(true);
    expect(result?.usedFields).toEqual([{ component: 'hero', field: 'headline' }]);
    expect(result?.issues.some(i => i.field === 'headline' && i.code === 'missing_required_field')).toBe(true);
  });

  it('should flag stories using a removed component as broken', () => {
    const oldSchema = toSchemaLike([makeComponent('page', { body: { type: 'bloks' } }), makeComponent('teaser', {})]);
    const newSchema = toSchemaLike([makeComponent('page', { body: { type: 'bloks' } })]);
    const impacted: ImpactedMap = new Map([
      ['teaser', { component: 'teaser', action: 'removed', fields: [] }],
    ]);
    const story = makeStory({ content: { _uid: 'r', component: 'page', body: [{ _uid: 'a', component: 'teaser' }] } });

    const result = analyzeStory(story, createAnalyzeContext(impacted, oldSchema, newSchema));

    expect(result?.broken).toBe(true);
    expect(result?.issues.some(i => i.component === 'teaser' && i.code === 'component_removed')).toBe(true);
  });

  it('should return null for stories that do not use any impacted component', () => {
    const schema = toSchemaLike([makeComponent('hero', { title: { type: 'text' } })]);
    const impacted: ImpactedMap = new Map([
      ['hero', { component: 'hero', action: 'update', fields: [{ field: 'title', contentKey: 'title', kind: 'type_changed' }] }],
    ]);
    const story = makeStory({ content: { _uid: 'r', component: 'other' } });

    expect(analyzeStory(story, createAnalyzeContext(impacted, schema, schema))).toBeNull();
  });
});

describe('aggregate', () => {
  it('should total used and broken stories per component and field', () => {
    const impacted: ImpactedMap = new Map([
      ['hero', { component: 'hero', action: 'update', fields: [{ field: 'title', contentKey: 'title', kind: 'required_added' }] }],
    ]);
    const stories = [
      { id: 1, uuid: 'a', name: 'A', full_slug: 'a', components: ['hero'], usedFields: [{ component: 'hero', field: 'title' }], broken: true, issues: [{ component: 'hero', field: 'title', severity: 'error' as const, code: 'missing_required_field', message: '' }] },
      { id: 2, uuid: 'b', name: 'B', full_slug: 'b', components: ['hero'], usedFields: [], broken: false, issues: [] },
    ];

    const report = aggregate('12345', impacted, stories);

    expect(report.totals).toEqual({ usedStories: 2, brokenStories: 1, brokenComponents: 1 });
    const hero = report.components[0];
    expect(hero).toMatchObject({ component: 'hero', usedStories: 2, brokenStories: 1 });
    expect(hero.fields[0]).toMatchObject({ field: 'title', used: 1, broken: 1 });
  });
});
