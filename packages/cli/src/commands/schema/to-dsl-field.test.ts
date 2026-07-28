import { describe, expect, it } from 'vitest';

import { resolveGroupWhitelistEntries, toDslField } from './to-dsl-field';

describe('toDslField', () => {
  it('maps component_whitelist to allow', () => {
    expect(toDslField({ type: 'bloks', component_whitelist: ['hero'] })).toEqual({
      type: 'bloks',
      allow: ['hero'],
    });
  });

  it('maps a group whitelist through the caller-supplied resolver', () => {
    const result = toDslField(
      { type: 'bloks', component_group_whitelist: ['uuid-1'], restrict_components: true, restrict_type: 'groups' },
      uuid => (uuid === 'uuid-1' ? { folder: 'Layout' } : undefined),
    );

    expect(result).toEqual({ type: 'bloks', allow: [{ folder: 'Layout' }] });
  });

  it('prefers block names over a group whitelist when both are present', () => {
    const result = toDslField(
      { type: 'bloks', component_whitelist: ['hero'], component_group_whitelist: ['uuid-1'] },
      () => ({ folder: 'Layout' }),
    );

    expect(result.allow).toEqual(['hero']);
  });

  it('keeps the raw wire form when a group uuid cannot be resolved', () => {
    const result = toDslField(
      { type: 'bloks', component_group_whitelist: ['unknown'], restrict_type: 'groups' },
      () => undefined,
    );

    expect(result).toEqual({
      type: 'bloks',
      component_group_whitelist: ['unknown'],
      restrict_type: 'groups',
    });
  });

  it('maps datasource_slug to datasource', () => {
    expect(toDslField({ type: 'option', datasource_slug: 'colors' })).toEqual({
      type: 'option',
      datasource: 'colors',
    });
  });
});

describe('resolveGroupWhitelistEntries', () => {
  it('returns undefined when any uuid is unresolvable', () => {
    expect(resolveGroupWhitelistEntries(['a', 'b'], u => (u === 'a' ? 'A' : undefined))).toBeUndefined();
  });

  it('returns undefined for an empty whitelist', () => {
    expect(resolveGroupWhitelistEntries([], () => 'x')).toBeUndefined();
  });

  it('returns undefined when no resolver is supplied', () => {
    expect(resolveGroupWhitelistEntries(['a'])).toBeUndefined();
  });

  it('maps every uuid through the resolver', () => {
    expect(resolveGroupWhitelistEntries(['a', 'b'], u => u.toUpperCase())).toEqual(['A', 'B']);
  });
});
