import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vol } from 'memfs';
import { readDatasourcesFiles } from './actions';
import type { SpaceDatasource } from '../constants';
import { FileSystemError } from '../../../utils/error/filesystem-error';

// Mock datasources data that matches the SpaceDatasource interface
const mockDatasource1: SpaceDatasource = {
  id: 1,
  name: 'Countries',
  slug: 'countries',
  dimensions: [
    {
      name: 'United States',
      entry_value: 'us',
      datasource_id: 1,
      created_at: '2021-08-09T12:00:00Z',
      updated_at: '2021-08-09T12:00:00Z',
    },
    {
      name: 'Canada',
      entry_value: 'ca',
      datasource_id: 1,
      created_at: '2021-08-09T12:00:00Z',
      updated_at: '2021-08-09T12:00:00Z',
    },
  ],
  created_at: '2021-08-09T12:00:00Z',
  updated_at: '2021-08-09T12:00:00Z',
  entries: [
    { id: 101, name: 'blue', value: '#0000ff', dimension_value: '', datasource_id: 1 },
    { id: 102, name: 'red', value: '#ff0000', dimension_value: '', datasource_id: 1 },
  ],
};

const mockDatasource2: SpaceDatasource = {
  id: 2,
  name: 'Categories',
  slug: 'categories',
  dimensions: [
    {
      name: 'Technology',
      entry_value: 'tech',
      datasource_id: 2,
      created_at: '2021-08-09T12:00:00Z',
      updated_at: '2021-08-09T12:00:00Z',
    },
  ],
  created_at: '2021-08-09T12:00:00Z',
  updated_at: '2021-08-09T12:00:00Z',
  entries: [
    { id: 201, name: 'tech', value: 'Technology', dimension_value: '', datasource_id: 2 },
    { id: 202, name: 'business', value: 'Business', dimension_value: '', datasource_id: 2 },
  ],
};

describe('push datasources actions', () => {
  beforeEach(() => {
    vol.reset();
  });

  afterEach(() => {
    vol.reset();
  });

  describe('readDatasourcesFiles', () => {
    describe('error handling', () => {
      it('should throw FileSystemError when directory does not exist', async () => {
        // Don't create any directory structure

        await expect(
          readDatasourcesFiles({
            from: 'source-space',
            path: '/mock/path',
            space: 'target-space',
            verbose: false,
          }),
        ).rejects.toThrow(FileSystemError);

        try {
          await readDatasourcesFiles({
            from: 'source-space',
            path: '/mock/path',
            space: 'target-space',
            verbose: false,
          });
        }
        catch (error) {
          expect(error).toBeInstanceOf(FileSystemError);
          expect((error as FileSystemError).message).toContain('No local datasources found for space source-space');
          expect((error as FileSystemError).message).toContain('storyblok datasources pull --space source-space');
          expect((error as FileSystemError).message).toContain('storyblok datasources push --space <target_space> --from source-space');
        }
      });
    });

    describe('separate files (content-detected)', () => {
      it('should read datasources from separate files without suffix', async () => {
        // Create mock filesystem with separate files
        vol.fromJSON({
          '/mock/path/datasources/source-space/countries.json': JSON.stringify(mockDatasource1),
          '/mock/path/datasources/source-space/categories.json': JSON.stringify(mockDatasource2),
        });

        const result = await readDatasourcesFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          verbose: false,
        });

        expect(result.datasources).toHaveLength(2);
        // Don't rely on order since readdir doesn't guarantee specific order
        expect(result.datasources).toContainEqual(mockDatasource1);
        expect(result.datasources).toContainEqual(mockDatasource2);
      });

      it('should read datasources from separate files with suffix', async () => {
        // Create mock filesystem with suffixed files
        vol.fromJSON({
          '/mock/path/datasources/source-space/countries.dev.json': JSON.stringify(mockDatasource1),
          '/mock/path/datasources/source-space/categories.dev.json': JSON.stringify(mockDatasource2),
          '/mock/path/datasources/source-space/other.json': JSON.stringify(mockDatasource1), // Should be ignored
        });

        const result = await readDatasourcesFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          suffix: 'dev',
          verbose: false,
        });

        expect(result.datasources).toHaveLength(2);
        // Don't rely on order since readdir doesn't guarantee specific order
        expect(result.datasources).toContainEqual(mockDatasource1);
        expect(result.datasources).toContainEqual(mockDatasource2);
      });

      it('should handle empty directory', async () => {
        // Create empty directory
        vol.fromJSON({
          '/mock/path/datasources/source-space/': null,
        });

        await expect(readDatasourcesFiles({
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
          '/mock/path/datasources/source-space/countries.json': JSON.stringify(mockDatasource1),
          '/mock/path/datasources/source-space/categories.dev.json': JSON.stringify(mockDatasource2),
        });

        const result = await readDatasourcesFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          verbose: false,
        });

        expect(result.datasources).toHaveLength(2);
        expect(result.datasources).toContainEqual(mockDatasource1);
        expect(result.datasources).toContainEqual(mockDatasource2);
      });

      it('should handle non-JSON files gracefully', async () => {
        // Create directory with mixed file types
        vol.fromJSON({
          '/mock/path/datasources/source-space/countries.json': JSON.stringify(mockDatasource1),
          '/mock/path/datasources/source-space/readme.txt': 'This is a text file',
          '/mock/path/datasources/source-space/config.yaml': 'key: value',
        });

        const result = await readDatasourcesFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          verbose: false,
        });

        expect(result.datasources).toHaveLength(1);
        expect(result.datasources[0]).toEqual(mockDatasource1);
      });
    });

    describe('consolidated files (content-detected)', () => {
      it('should read datasources from consolidated file without suffix', async () => {
        // Create mock filesystem with consolidated file
        vol.fromJSON({
          '/mock/path/datasources/source-space/datasources.json': JSON.stringify([mockDatasource1, mockDatasource2]),
        });

        const result = await readDatasourcesFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          verbose: false,
        });

        expect(result.datasources).toHaveLength(2);
        expect(result.datasources).toContainEqual(mockDatasource1);
        expect(result.datasources).toContainEqual(mockDatasource2);
      });

      it('should read datasources from consolidated file with suffix', async () => {
        // Create mock filesystem with suffixed consolidated file
        vol.fromJSON({
          '/mock/path/datasources/source-space/datasources.dev.json': JSON.stringify([mockDatasource1, mockDatasource2]),
        });

        const result = await readDatasourcesFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          suffix: 'dev',
          verbose: false,
        });

        expect(result.datasources).toHaveLength(2);
        expect(result.datasources).toContainEqual(mockDatasource1);
        expect(result.datasources).toContainEqual(mockDatasource2);
      });

      it('should read consolidated file with custom filename', async () => {
        // Custom filename (e.g., --filename my-data) creates my-data.json instead of datasources.json
        vol.fromJSON({
          '/mock/path/datasources/source-space/my-data.json': JSON.stringify([mockDatasource1, mockDatasource2]),
        });

        const result = await readDatasourcesFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          verbose: false,
        });

        // Content-based detection reads any JSON file — filename doesn't matter
        expect(result.datasources).toHaveLength(2);
      });

      it('should throw error when no datasource data exists', async () => {
        // Create directory but no datasource files
        vol.fromJSON({
          '/mock/path/datasources/source-space/': null,
        });

        await expect(
          readDatasourcesFiles({
            from: 'source-space',
            path: '/mock/path',
            space: 'target-space',
            verbose: false,
          }),
        ).rejects.toThrow(FileSystemError);
      });

      it('should throw error when consolidated file contains invalid JSON', async () => {
        // Create file with invalid JSON
        vol.fromJSON({
          '/mock/path/datasources/source-space/datasources.json': '{ invalid json }',
        });

        await expect(
          readDatasourcesFiles({
            from: 'source-space',
            path: '/mock/path',
            space: 'target-space',
            verbose: false,
          }),
        ).rejects.toThrow();
      });
    });

    describe('duplicate detection', () => {
      it('should throw when the same datasource exists in multiple files', async () => {
        vol.fromJSON({
          '/mock/path/datasources/source-space/countries.json': JSON.stringify(mockDatasource1),
          '/mock/path/datasources/source-space/datasources.json': JSON.stringify([mockDatasource1, mockDatasource2]),
        });

        await expect(
          readDatasourcesFiles({
            from: 'source-space',
            path: '/mock/path',
            space: 'target-space',
            verbose: false,
          }),
        ).rejects.toThrow('Duplicate datasources found in');
      });

      it('should allow mixed formats when there are no duplicate datasources', async () => {
        // countries.json has mockDatasource1, datasources.json has only mockDatasource2 — no overlap
        vol.fromJSON({
          '/mock/path/datasources/source-space/countries.json': JSON.stringify(mockDatasource1),
          '/mock/path/datasources/source-space/datasources.json': JSON.stringify([mockDatasource2]),
        });

        const result = await readDatasourcesFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          verbose: false,
        });

        expect(result.datasources).toHaveLength(2);
        expect(result.datasources).toContainEqual(mockDatasource1);
        expect(result.datasources).toContainEqual(mockDatasource2);
      });
    });

    describe('path resolution', () => {
      it('should use correct path resolution', async () => {
        // Test that the function looks in the right directory structure
        vol.fromJSON({
          '/custom/base/path/datasources/my-space/datasources.json': JSON.stringify([mockDatasource1]),
        });

        const result = await readDatasourcesFiles({
          from: 'my-space',
          path: '/custom/base/path',
          space: 'target-space',
          verbose: false,
        });

        expect(result.datasources).toHaveLength(1);
        expect(result.datasources[0]).toEqual(mockDatasource1);
      });

      it('should read from different source space than target space', async () => {
        // Simulate cross-space migration scenario
        vol.fromJSON({
          '/mock/path/datasources/production-space/datasources.json': JSON.stringify([mockDatasource1, mockDatasource2]),
          '/mock/path/datasources/staging-space/datasources.json': JSON.stringify([mockDatasource1]), // Different content
        });

        // Reading from production-space (from) to push to staging-space (space)
        const result = await readDatasourcesFiles({
          from: 'production-space',
          path: '/mock/path',
          space: 'staging-space',
          verbose: false,
        });

        expect(result.datasources).toHaveLength(2);
        expect(result.datasources).toContainEqual(mockDatasource1);
        expect(result.datasources).toContainEqual(mockDatasource2);
      });
    });
  });
});
