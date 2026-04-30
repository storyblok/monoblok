import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readComponentsFiles } from './actions';
import type { Component, ComponentFolder, InternalTag, Preset } from '../constants';
import { vol } from 'memfs';
import { FileSystemError } from '../../../utils';

// Mock components data
const mockComponent1: Component = {
  name: 'author',
  display_name: undefined,
  created_at: '2025-10-10T12:12:18.056Z',
  updated_at: '2025-11-07T11:29:44.892Z',
  id: 1,
  schema: {
    name: {
      type: 'text',
      pos: 0,
      id: 'bUn1LJNrRBGLg1-U48tCRw',
    },
    sex: {
      type: 'option',
      pos: 1,
      use_uuid: true,
      source: 'internal',
      datasource_slug: 'garden-325',
      id: '679gCtyCRbKrTlUkXBHw7w',
    },
  },
  image: undefined,
  preview_field: undefined,
  is_root: true,
  preview_tmpl: undefined,
  is_nestable: true,
  all_presets: [],
  preset_id: undefined,
  real_name: 'author',
  component_group_uuid: undefined,
  color: undefined,
  icon: undefined,
  internal_tags_list: [],
  internal_tag_ids: [],
  content_type_asset_preview: undefined,
};

const mockComponent2: Component = {
  name: 'feature',
  display_name: undefined,
  created_at: '2025-10-09T06:29:14.630Z',
  updated_at: '2025-10-09T06:29:14.630Z',
  id: 2,
  schema: {
    name: {
      type: 'text',
      id: 'vGYQ0cWzS0yxKosyVtZQ6w',
    },
  },
  image: undefined,
  preview_field: undefined,
  is_root: false,
  preview_tmpl: undefined,
  is_nestable: true,
  all_presets: [],
  preset_id: undefined,
  real_name: 'feature',
  component_group_uuid: undefined,
  color: undefined,
  icon: undefined,
  internal_tags_list: [],
  internal_tag_ids: [],
  content_type_asset_preview: undefined,
};

const mockGroup1: ComponentFolder = {
  id: 1,
  name: 'Content',
  uuid: 'group-uuid-1',
  parent_id: undefined,
};

const mockGroup2: ComponentFolder = {
  id: 2,
  name: 'Layout',
  uuid: 'group-uuid-2',
  parent_id: undefined,
};

const mockPreset1: Preset = {
  id: 1,
  name: 'Hero Preset',
  component_id: 1,
  preset: {},
  created_at: '2021-08-09T12:00:00Z',
  updated_at: '2021-08-09T12:00:00Z',
  space_id: 12345,
  image: undefined,
  color: undefined,
  icon: undefined,
  description: undefined,
};

const mockTag1: InternalTag = {
  id: 1,
  name: 'internal-tag',
  object_type: 'component',
};

describe('push components actions', () => {
  beforeEach(() => {
    vol.reset();
  });

  afterEach(() => {
    vol.reset();
  });

  describe('readComponentsFiles', () => {
    describe('error handling', () => {
      it('should throw FileSystemError when directory does not exist', async () => {
        // Don't create any directory structure

        await expect(
          readComponentsFiles({
            from: 'source-space',
            path: '/mock/path',
            space: 'target-space',
            verbose: false,
          }),
        ).rejects.toThrow(FileSystemError);

        try {
          await readComponentsFiles({
            from: 'source-space',
            path: '/mock/path',
            space: 'target-space',
            verbose: false,
          });
        }
        catch (error) {
          expect(error).toBeInstanceOf(FileSystemError);
          expect((error as FileSystemError).message).toContain('No local components found for space source-space');
          expect((error as FileSystemError).message).toContain('storyblok components pull --space source-space');
          expect((error as FileSystemError).message).toContain('storyblok components push --space <target_space> --from source-space');
        }
      });
    });

    describe('separate files mode', () => {
      it('should read components from separate files without suffix', async () => {
        // Create mock filesystem with separate files
        vol.fromJSON({
          '/mock/path/components/source-space/hero.json': JSON.stringify(mockComponent1),
          '/mock/path/components/source-space/feature.json': JSON.stringify(mockComponent2),
          '/mock/path/components/source-space/groups.json': JSON.stringify([mockGroup1, mockGroup2]),
          '/mock/path/components/source-space/tags.json': JSON.stringify([mockTag1]),
        });

        const result = await readComponentsFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          verbose: false,
        });

        expect(result.components).toHaveLength(2);
        expect(result.components).toContainEqual(mockComponent1);
        expect(result.components).toContainEqual(mockComponent2);
        expect(result.groups).toHaveLength(2);
        expect(result.internalTags).toHaveLength(1);
      });

      it('should read components from separate files with suffix', async () => {
        // Create mock filesystem with suffixed files
        vol.fromJSON({
          '/mock/path/components/source-space/hero.dev.json': JSON.stringify(mockComponent1),
          '/mock/path/components/source-space/feature.dev.json': JSON.stringify(mockComponent2),
          '/mock/path/components/source-space/groups.dev.json': JSON.stringify([mockGroup1]),
          '/mock/path/components/source-space/other.json': JSON.stringify(mockComponent1), // Should be ignored (wrong suffix)
        });

        const result = await readComponentsFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          suffix: 'dev',
          verbose: false,
        });

        expect(result.components).toHaveLength(2);
        expect(result.components).toContainEqual(mockComponent1);
        expect(result.components).toContainEqual(mockComponent2);
        expect(result.groups).toHaveLength(1);
      });

      it('should read component presets from separate preset files', async () => {
        // Create mock filesystem with component and preset files
        vol.fromJSON({
          '/mock/path/components/source-space/hero.json': JSON.stringify(mockComponent1),
          '/mock/path/components/source-space/hero.presets.json': JSON.stringify([mockPreset1]),
        });

        const result = await readComponentsFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          verbose: false,
        });

        expect(result.components).toHaveLength(1);
        expect(result.presets).toHaveLength(1);
        expect(result.presets[0]).toEqual(mockPreset1);
      });

      it('should handle empty directory', async () => {
        // Create empty directory
        vol.fromJSON({
          '/mock/path/components/source-space/': null,
        });

        await expect(readComponentsFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          verbose: false,
        })).rejects.toThrow(FileSystemError);
      });

      it('should include all JSON files when no suffix is specified', async () => {
        // Without --suffix, all .json files are loaded regardless of naming pattern.
        // Use --suffix to target only a specific environment subset (e.g. --suffix dev).
        vol.fromJSON({
          '/mock/path/components/source-space/hero.json': JSON.stringify(mockComponent1),
          '/mock/path/components/source-space/feature.dev.json': JSON.stringify(mockComponent2),
        });

        const result = await readComponentsFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          verbose: false,
        });

        expect(result.components).toHaveLength(2);
        expect(result.components).toContainEqual(mockComponent1);
        expect(result.components).toContainEqual(mockComponent2);
      });

      it('should handle non-JSON files gracefully', async () => {
        // Create directory with mixed file types
        vol.fromJSON({
          '/mock/path/components/source-space/hero.json': JSON.stringify(mockComponent1),
          '/mock/path/components/source-space/readme.txt': 'This is a text file',
          '/mock/path/components/source-space/config.yaml': 'key: value',
        });

        const result = await readComponentsFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          verbose: false,
        });

        expect(result.components).toHaveLength(1);
        expect(result.components[0]).toEqual(mockComponent1);
      });
    });

    describe('consolidated files mode', () => {
      it('should read components from consolidated file without suffix', async () => {
        // Create mock filesystem with consolidated files
        vol.fromJSON({
          '/mock/path/components/source-space/components.json': JSON.stringify([mockComponent1, mockComponent2]),
          '/mock/path/components/source-space/groups.json': JSON.stringify([mockGroup1, mockGroup2]),
          '/mock/path/components/source-space/presets.json': JSON.stringify([mockPreset1]),
          '/mock/path/components/source-space/tags.json': JSON.stringify([mockTag1]),
        });

        const result = await readComponentsFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          verbose: false,
        });

        expect(result.components).toHaveLength(2);
        expect(result.components).toContainEqual(mockComponent1);
        expect(result.components).toContainEqual(mockComponent2);
        expect(result.groups).toHaveLength(2);
        expect(result.presets).toHaveLength(1);
        expect(result.internalTags).toHaveLength(1);
      });

      it('should read components from consolidated file with suffix', async () => {
        // Create mock filesystem with suffixed consolidated files
        vol.fromJSON({
          '/mock/path/components/source-space/components.dev.json': JSON.stringify([mockComponent1, mockComponent2]),
          '/mock/path/components/source-space/groups.dev.json': JSON.stringify([mockGroup1]),
        });

        const result = await readComponentsFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          suffix: 'dev',
          verbose: false,
        });

        expect(result.components).toHaveLength(2);
        expect(result.components).toContainEqual(mockComponent1);
        expect(result.components).toContainEqual(mockComponent2);
        expect(result.groups).toHaveLength(1);
      });

      it('should read consolidated file with custom filename', async () => {
        // Custom filename (e.g., --filename my-schema) creates my-schema.json instead of components.json
        vol.fromJSON({
          '/mock/path/components/source-space/my-schemas.json': JSON.stringify([mockComponent1, mockComponent2]),
        });

        const result = await readComponentsFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          verbose: false,
        });

        // Content-based detection reads any JSON file — filename doesn't matter
        expect(result.components).toHaveLength(2);
      });

      it('should throw error when no component data exists', async () => {
        // Create directory but no component files
        vol.fromJSON({
          '/mock/path/components/source-space/': null,
        });

        await expect(
          readComponentsFiles({
            from: 'source-space',
            path: '/mock/path',
            space: 'target-space',
            verbose: false,
          }),
        ).rejects.toThrow(FileSystemError);
      });

      it('should handle optional files gracefully in consolidated mode', async () => {
        // Create only required components file
        vol.fromJSON({
          '/mock/path/components/source-space/components.json': JSON.stringify([mockComponent1]),
        });

        const result = await readComponentsFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          verbose: false,
        });

        expect(result.components).toHaveLength(1);
        expect(result.groups).toHaveLength(0);
        expect(result.presets).toHaveLength(0);
        expect(result.internalTags).toHaveLength(0);
      });

      it('should throw error when consolidated file contains invalid JSON', async () => {
        // Create file with invalid JSON
        vol.fromJSON({
          '/mock/path/components/source-space/components.json': '{ invalid json }',
        });

        await expect(
          readComponentsFiles({
            from: 'source-space',
            path: '/mock/path',
            space: 'target-space',
            verbose: false,
          }),
        ).rejects.toThrow();
      });
    });

    describe('duplicate detection', () => {
      it('should throw when the same component exists in multiple files', async () => {
        vol.fromJSON({
          '/mock/path/components/source-space/hero.json': JSON.stringify(mockComponent1),
          '/mock/path/components/source-space/components.json': JSON.stringify([mockComponent1, mockComponent2]),
        });

        await expect(
          readComponentsFiles({
            from: 'source-space',
            path: '/mock/path',
            space: 'target-space',
            verbose: false,
          }),
        ).rejects.toThrow('Duplicate components found in');
      });

      it('should allow mixed formats when there are no duplicate components', async () => {
        // hero.json has mockComponent1, components.json has only mockComponent2 — no overlap
        vol.fromJSON({
          '/mock/path/components/source-space/hero.json': JSON.stringify(mockComponent1),
          '/mock/path/components/source-space/components.json': JSON.stringify([mockComponent2]),
        });

        const result = await readComponentsFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          verbose: false,
        });

        expect(result.components).toHaveLength(2);
        expect(result.components).toContainEqual(mockComponent1);
        expect(result.components).toContainEqual(mockComponent2);
      });

      it('should not error when groups/tags arrays coexist with separate component files', async () => {
        // groups.json is always an array — this is NOT a duplicate conflict
        vol.fromJSON({
          '/mock/path/components/source-space/hero.json': JSON.stringify(mockComponent1),
          '/mock/path/components/source-space/groups.json': JSON.stringify([mockGroup1, mockGroup2]),
          '/mock/path/components/source-space/tags.json': JSON.stringify([mockTag1]),
        });

        const result = await readComponentsFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          verbose: false,
        });

        expect(result.components).toHaveLength(1);
        expect(result.groups).toHaveLength(2);
        expect(result.internalTags).toHaveLength(1);
      });
    });

    describe('content-based classification', () => {
      it('should classify all entity types from a single mixed file', async () => {
        // A single file containing components, groups, presets, and tags mixed together
        const mixedData = [mockComponent1, mockGroup1, mockPreset1, mockTag1, mockComponent2, mockGroup2];

        vol.fromJSON({
          '/mock/path/components/source-space/everything.json': JSON.stringify(mixedData),
        });

        const result = await readComponentsFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          verbose: false,
        });

        expect(result.components).toHaveLength(2);
        expect(result.components).toContainEqual(mockComponent1);
        expect(result.components).toContainEqual(mockComponent2);
        expect(result.groups).toHaveLength(2);
        expect(result.presets).toHaveLength(1);
        expect(result.internalTags).toHaveLength(1);
      });

      it('should skip unrecognized items without error', async () => {
        const dataWithUnknown = [
          mockComponent1,
          { foo: 'bar', baz: 42 },
          { unknown_field: true },
        ];

        vol.fromJSON({
          '/mock/path/components/source-space/data.json': JSON.stringify(dataWithUnknown),
        });

        const result = await readComponentsFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          verbose: false,
        });

        expect(result.components).toHaveLength(1);
        expect(result.components[0]).toEqual(mockComponent1);
        expect(result.groups).toHaveLength(0);
        expect(result.presets).toHaveLength(0);
        expect(result.internalTags).toHaveLength(0);
      });
    });

    describe('path resolution', () => {
      it('should use correct path resolution for source space', async () => {
        // Test that the function looks in the right directory structure
        vol.fromJSON({
          '/custom/base/path/components/my-source-space/components.json': JSON.stringify([mockComponent1]),
        });

        const result = await readComponentsFiles({
          from: 'my-source-space',
          path: '/custom/base/path',
          space: 'target-space',
          verbose: false,
        });

        expect(result.components).toHaveLength(1);
        expect(result.components[0]).toEqual(mockComponent1);
      });

      it('should read from different source space than target space', async () => {
        // Simulate cross-space migration scenario
        vol.fromJSON({
          '/mock/path/components/production-space/components.json': JSON.stringify([mockComponent1, mockComponent2]),
          '/mock/path/components/staging-space/components.json': JSON.stringify([mockComponent1]), // Different content
        });

        // Reading from production-space (from) to push to staging-space (space)
        const result = await readComponentsFiles({
          from: 'production-space',
          path: '/mock/path',
          space: 'staging-space',
          verbose: false,
        });

        expect(result.components).toHaveLength(2);
        expect(result.components).toContainEqual(mockComponent1);
        expect(result.components).toContainEqual(mockComponent2);
      });
    });
  });
});
