import { randomUUID } from 'node:crypto';
import { join } from 'pathe';
import { describe, expect, it } from 'vitest';
import { vol } from 'memfs';
import { findComponentSchemas, isStoryPublishedWithoutChanges, isStoryWithUnpublishedChanges } from './utils';
import { FileSystemError } from '../../utils/error/filesystem-error';

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

  it('should include components from suffix-tagged files (e.g. pulled with --suffix dev)', async () => {
    // Users who pull components with --suffix dev get components.dev.json.
    // findComponentSchemas must still find those schemas for story validation.
    const componentC = { name: 'component_c', schema: { field_c: {} }, component_group_uuid: null };

    vol.fromJSON({
      [join(COMPONENTS_DIR, 'components.dev.json')]: JSON.stringify([componentC]),
    });

    expect(await findComponentSchemas(COMPONENTS_DIR)).toEqual({
      component_c: componentC.schema,
    });
  });

  it('should throw with validation context when duplicate components are detected', async () => {
    const component = { name: 'hero', schema: { title: {} }, component_group_uuid: null };

    vol.fromJSON({
      [join(COMPONENTS_DIR, 'components.json')]: JSON.stringify([component]),
      [join(COMPONENTS_DIR, 'components.dev.json')]: JSON.stringify([component]),
    });

    await expect(findComponentSchemas(COMPONENTS_DIR)).rejects.toSatisfy((error: FileSystemError) => {
      return error instanceof FileSystemError
        && error.message.includes('Failed to load component schemas for content validation')
        && error.message.includes('Duplicate components found');
    });
  });
});
