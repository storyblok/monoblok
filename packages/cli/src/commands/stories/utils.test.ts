import { randomUUID } from 'node:crypto';
import { join } from 'pathe';
import { describe, expect, it } from 'vitest';
import { vol } from 'memfs';
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

describe('findComponentSchemas', () => {
  it('should return name-to-schema map from component files', async () => {
    const componentA = { name: 'component_a', schema: { field_a: {} }, component_group_uuid: null };
    const componentB = { name: 'component_b', schema: { field_b: {} }, component_group_uuid: randomUUID() };

    vol.fromJSON({
      [join(COMPONENTS_DIR, 'component_a.json')]: JSON.stringify(componentA),
      [join(COMPONENTS_DIR, 'component_b.json')]: JSON.stringify(componentB),
    });

    expect(await findComponentSchemas(COMPONENTS_DIR)).toEqual({
      component_a: componentA.schema,
      component_b: componentB.schema,
    });
  });

  it('should return empty object when directory does not exist', async () => {
    expect(await findComponentSchemas('/nonexistent/path')).toEqual({});
  });
});
