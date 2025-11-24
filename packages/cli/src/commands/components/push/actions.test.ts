import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readComponentsFiles } from './actions';
import type { SpaceComponent, SpaceComponentFolder, SpaceComponentInternalTag, SpaceComponentPreset } from '../constants';
import { vol } from 'memfs';
import { FileSystemError } from '../../../utils';

// Mock filesystem modules
vi.mock('node:fs');
vi.mock('node:fs/promises');

// Mock components data
const mockComponent1: SpaceComponent = {
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

const mockComponent2: SpaceComponent = {
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

const mockGroup1: SpaceComponentFolder = {
  id: 1,
  name: 'Content',
  uuid: 'group-uuid-1',
  parent_id: undefined,
};

const mockGroup2: SpaceComponentFolder = {
  id: 2,
  name: 'Layout',
  uuid: 'group-uuid-2',
  parent_id: undefined,
};

const mockPreset1: SpaceComponentPreset = {
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

const mockTag1: SpaceComponentInternalTag = {
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
            separateFiles: false,
            verbose: false,
          }),
        ).rejects.toThrow(FileSystemError);

        try {
          await readComponentsFiles({
            from: 'source-space',
            path: '/mock/path',
            space: 'target-space',
            separateFiles: false,
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
          '/mock/path/components/source-space/hero.json': JSON.stringify([mockComponent1]),
          '/mock/path/components/source-space/feature.json': JSON.stringify([mockComponent2]),
          '/mock/path/components/source-space/groups.json': JSON.stringify([mockGroup1, mockGroup2]),
          '/mock/path/components/source-space/tags.json': JSON.stringify([mockTag1]),
        });

        const result = await readComponentsFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          separateFiles: true,
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
          '/mock/path/components/source-space/hero.dev.json': JSON.stringify([mockComponent1]),
          '/mock/path/components/source-space/feature.dev.json': JSON.stringify([mockComponent2]),
          '/mock/path/components/source-space/groups.dev.json': JSON.stringify([mockGroup1]),
          '/mock/path/components/source-space/other.json': JSON.stringify([mockComponent1]), // Should be ignored
        });

        const result = await readComponentsFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          separateFiles: true,
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
          '/mock/path/components/source-space/hero.json': JSON.stringify([mockComponent1]),
          '/mock/path/components/source-space/hero.presets.json': JSON.stringify([mockPreset1]),
        });

        const result = await readComponentsFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          separateFiles: true,
          verbose: false,
        });

        expect(result.components).toHaveLength(1);
        expect(result.presets).toHaveLength(1);
        expect(result.presets[0]).toEqual(mockPreset1);
      });

      it('should filter out consolidated files when reading separate files', async () => {
        // Create mock filesystem with mixed files
        vol.fromJSON({
          '/mock/path/components/source-space/hero.json': JSON.stringify([mockComponent1]),
          '/mock/path/components/source-space/components.json': JSON.stringify([mockComponent1, mockComponent2]), // Should be ignored
        });

        const result = await readComponentsFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          separateFiles: true,
          verbose: false,
        });

        // Should only include the separate file, not the consolidated file
        expect(result.components).toHaveLength(1);
        expect(result.components[0]).toEqual(mockComponent1);
      });

      it('should handle empty directory in separate files mode', async () => {
        // Create empty directory
        vol.fromJSON({
          '/mock/path/components/source-space/': null,
        });

        const result = await readComponentsFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          separateFiles: true,
          verbose: false,
        });

        expect(result.components).toHaveLength(0);
        expect(result.groups).toHaveLength(0);
        expect(result.presets).toHaveLength(0);
        expect(result.internalTags).toHaveLength(0);
      });

      it('should handle files without suffix pattern correctly', async () => {
        // Create files with various patterns
        vol.fromJSON({
          '/mock/path/components/source-space/hero.json': JSON.stringify([mockComponent1]),
          '/mock/path/components/source-space/feature.dev.json': JSON.stringify([mockComponent2]), // Has suffix pattern, should be ignored
        });

        const result = await readComponentsFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          separateFiles: true,
          verbose: false,
        });

        // Should only include files without suffix pattern
        expect(result.components).toHaveLength(1);
        expect(result.components[0]).toEqual(mockComponent1);
      });

      it('should handle non-JSON files gracefully', async () => {
        // Create directory with mixed file types
        vol.fromJSON({
          '/mock/path/components/source-space/hero.json': JSON.stringify([mockComponent1]),
          '/mock/path/components/source-space/readme.txt': 'This is a text file',
          '/mock/path/components/source-space/config.yaml': 'key: value',
        });

        const result = await readComponentsFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          separateFiles: true,
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
          separateFiles: false,
          verbose: false,
        });

        expect(result.components).toHaveLength(2);
        expect(result.components[0]).toEqual(mockComponent1);
        expect(result.components[1]).toEqual(mockComponent2);
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
          separateFiles: false,
          suffix: 'dev',
          verbose: false,
        });

        expect(result.components).toHaveLength(2);
        expect(result.components[0]).toEqual(mockComponent1);
        expect(result.components[1]).toEqual(mockComponent2);
        expect(result.groups).toHaveLength(1);
      });

      it('should throw error when consolidated components file does not exist', async () => {
        // Create directory but no consolidated file
        vol.fromJSON({
          '/mock/path/components/source-space/': null,
        });

        await expect(
          readComponentsFiles({
            from: 'source-space',
            path: '/mock/path',
            space: 'target-space',
            separateFiles: false,
            verbose: false,
          }),
        ).rejects.toThrow(FileSystemError);
      });

      it('should throw error when consolidated components file is empty', async () => {
        // Create empty consolidated file
        vol.fromJSON({
          '/mock/path/components/source-space/components.json': JSON.stringify([]),
        });

        await expect(
          readComponentsFiles({
            from: 'source-space',
            path: '/mock/path',
            space: 'target-space',
            separateFiles: false,
            verbose: false,
          }),
        ).rejects.toThrow(FileSystemError);

        try {
          await readComponentsFiles({
            from: 'source-space',
            path: '/mock/path',
            space: 'target-space',
            separateFiles: false,
            verbose: false,
          });
        }
        catch (error) {
          expect(error).toBeInstanceOf(FileSystemError);
          expect((error as FileSystemError).message).toContain('No components found');
          expect((error as FileSystemError).message).toContain('Please make sure you have pulled the components first');
        }
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
          separateFiles: false,
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
            separateFiles: false,
            verbose: false,
          }),
        ).rejects.toThrow();
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
          separateFiles: false,
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
          separateFiles: false,
          verbose: false,
        });

        expect(result.components).toHaveLength(2);
        expect(result.components).toContainEqual(mockComponent1);
        expect(result.components).toContainEqual(mockComponent2);
      });
    });
  });
});
