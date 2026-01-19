import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { vol } from 'memfs';
import type { Component } from '@storyblok/management-api-client/resources/components';
import { findComponentSchemas, isStoryPublishedWithoutChanges, isStoryWithUnpublishedChanges } from './utils';

describe('isStoryPublishedWithoutChanges', () => {
  it('should return true for published stories without changes', () => {
    expect(isStoryPublishedWithoutChanges({ published: true, unpublished_changes: false })).toBe(true);
  });

  it('should return false for unpublished stories', () => {
    expect(isStoryPublishedWithoutChanges({ published: false, unpublished_changes: false })).toBe(false);
  });

  it('should return false for published stories with changes', () => {
    expect(isStoryPublishedWithoutChanges({ published: true, unpublished_changes: true })).toBe(false);
  });

  it('should return false for unpublished stories with changes', () => {
    expect(isStoryPublishedWithoutChanges({ published: false, unpublished_changes: true })).toBe(false);
  });
});

describe('isStoryWithUnpublishedChanges', () => {
  it('should return true for published stories with changes', () => {
    expect(isStoryWithUnpublishedChanges({ published: true, unpublished_changes: true })).toBe(true);
  });

  it('should return false for published stories without changes', () => {
    expect(isStoryWithUnpublishedChanges({ published: true, unpublished_changes: false })).toBe(false);
  });

  it('should return false for unpublished stories', () => {
    expect(isStoryWithUnpublishedChanges({ published: false, unpublished_changes: false })).toBe(false);
  });

  it('should return false for unpublished stories with changes', () => {
    expect(isStoryWithUnpublishedChanges({ published: false, unpublished_changes: true })).toBe(false);
  });
});

const COMPONENTS_DIR = '.storyblok/components/12345';

const preconditions = {
  hasSingleComponentFile(components: Partial<Component>[]) {
    const otherFiles = [
      { name: 'other_a' },
      { name: 'other_b' },
    ];
    vol.fromJSON(Object.fromEntries([...otherFiles, components].map((f) => {
      const suffix = Math.random() < 0.5 ? '.suffix' : '';
      return [
        path.join(COMPONENTS_DIR, `${'name' in f ? f.name : 'components'}${suffix}.json`),
        JSON.stringify(f),
      ];
    })));
  },
  hasSeparateComponentFiles(components: Partial<Component>[]) {
    const otherFiles = [
      { name: 'other_a' },
      { name: 'other_b' },
    ];
    vol.fromJSON(Object.fromEntries([...otherFiles, ...components].map((c) => {
      const suffix = Math.random() < 0.5 ? '.suffix' : '';
      return [
        path.join(COMPONENTS_DIR, `${c.name}${suffix}.json`),
        JSON.stringify(c),
      ];
    })));
  },
};

describe('findComponentSchemas', () => {
  it('should return all component schemas found in single component file', async () => {
    const componentA = { name: 'component_a', schema: { field_a: {} }, component_group_uuid: null };
    const componentB = { name: 'component_b', schema: { field_b: {} }, component_group_uuid: randomUUID() };
    // @ts-expect-error Our Component type is wrong.
    preconditions.hasSingleComponentFile([componentA, componentB]);

    expect(await findComponentSchemas(COMPONENTS_DIR)).toEqual({
      component_a: componentA.schema,
      component_b: componentB.schema,
    });
  });

  it('should return all component schemas found in separate files', async () => {
    const componentA = { name: 'component_a', schema: { field_a: {} }, component_group_uuid: null };
    const componentB = { name: 'component_b', schema: { field_b: {} }, component_group_uuid: randomUUID() };
    // @ts-expect-error Our Component type is wrong.
    preconditions.hasSeparateComponentFiles([componentA, componentB]);

    expect(await findComponentSchemas(COMPONENTS_DIR)).toEqual({
      component_a: componentA.schema,
      component_b: componentB.schema,
    });
  });

  it('should return all component schemas found in separate files and single file', async () => {
    const componentA = { name: 'component_a', schema: { field_a: {} }, component_group_uuid: null };
    const componentB = { name: 'component_b', schema: { field_b: {} }, component_group_uuid: randomUUID() };
    // @ts-expect-error Our Component type is wrong.
    preconditions.hasSeparateComponentFiles([componentA]);
    preconditions.hasSingleComponentFile([componentB]);

    expect(await findComponentSchemas(COMPONENTS_DIR)).toEqual({
      component_a: componentA.schema,
      component_b: componentB.schema,
    });
  });
});
