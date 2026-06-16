import { describe, expect, it } from 'vitest';

import type { DatasourceEntry, Preset } from '../../types';
import { planEntries, planPresets } from './reconcile';

function preset(partial: Partial<Preset> & { id: number; name: string }): Preset {
  return { preset: null, component_id: 1, ...partial } as Preset;
}
function entry(partial: Partial<DatasourceEntry> & { id: number; name: string }): DatasourceEntry {
  return { value: '', datasource_id: 1, dimension_value: null, ...partial } as DatasourceEntry;
}

describe('planPresets', () => {
  it('creates presets that do not exist remotely', () => {
    const plan = planPresets([{ name: 'Hero', preset: { headline: 'Hi' } }], []);
    expect(plan.toCreate.map(p => p.name)).toEqual(['Hero']);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.toDelete).toEqual([]);
  });

  it('updates presets whose blob changed and ignores unchanged ones', () => {
    const remote = [preset({ id: 5, name: 'Hero', preset: { headline: 'Old' } }), preset({ id: 6, name: 'Same', preset: { a: 1 } })];
    const plan = planPresets([
      { name: 'Hero', preset: { headline: 'New' } },
      { name: 'Same', preset: { a: 1 } },
    ], remote);
    expect(plan.toUpdate).toEqual([{ id: 5, name: 'Hero', preset: { headline: 'New' } }]);
    expect(plan.toCreate).toEqual([]);
    expect(plan.toDelete).toEqual([]);
  });

  it('treats key order as equal (no false update)', () => {
    const remote = [preset({ id: 5, name: 'Hero', preset: { a: 1, b: 2 } })];
    const plan = planPresets([{ name: 'Hero', preset: { b: 2, a: 1 } }], remote);
    expect(plan.toUpdate).toEqual([]);
  });

  it('deletes remote presets with no local counterpart', () => {
    const plan = planPresets([], [preset({ id: 9, name: 'Stale' })]);
    expect(plan.toDelete).toEqual([9]);
  });
});

describe('planEntries', () => {
  it('creates, updates, and deletes by (name, dimension_value)', () => {
    const remote = [
      entry({ id: 1, name: 'Red', value: 'red' }),
      entry({ id: 2, name: 'Blue', value: 'navy' }),
      entry({ id: 3, name: 'Old', value: 'gone' }),
    ];
    const plan = planEntries([
      { name: 'Red', value: 'red' }, // unchanged
      { name: 'Blue', value: 'blue' }, // changed
      { name: 'Green', value: 'green' }, // new
    ], remote);

    expect(plan.toCreate.map(e => e.name)).toEqual(['Green']);
    expect(plan.toUpdate).toEqual([{ id: 2, name: 'Blue', value: 'blue', dimension_value: undefined }]);
    expect(plan.toDelete).toEqual([3]);
  });

  it('distinguishes entries that differ only by dimension_value', () => {
    const remote = [entry({ id: 1, name: 'Red', value: 'a', dimension_value: 'en' })];
    const plan = planEntries([
      { name: 'Red', value: 'a', dimension_value: 'en' }, // unchanged
      { name: 'Red', value: 'b', dimension_value: 'de' }, // new (different dimension)
    ], remote);

    expect(plan.toUpdate).toEqual([]);
    expect(plan.toCreate.map(e => e.dimension_value)).toEqual(['de']);
    expect(plan.toDelete).toEqual([]);
  });
});
