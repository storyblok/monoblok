import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readDatasourcesFiles } from './actions';
import type { SpaceDatasource } from '../constants';
import { vol } from 'memfs';
import { FileSystemError } from '../../../utils';

// Mock filesystem modules
vi.mock('node:fs');
vi.mock('node:fs/promises');

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
            separateFiles: true,
            verbose: false,
          }),
        ).rejects.toThrow(FileSystemError);

        try {
          await readDatasourcesFiles({
            from: 'source-space',
            path: '/mock/path',
            space: 'target-space',
            separateFiles: true,
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

    describe('separate files mode', () => {
      it('should read datasources from separate files without suffix', async () => {
        // Create mock filesystem with separate files
        vol.fromJSON({
          '/mock/path/datasources/source-space/countries.json': JSON.stringify([mockDatasource1]),
          '/mock/path/datasources/source-space/categories.json': JSON.stringify([mockDatasource2]),
        });

        const result = await readDatasourcesFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          separateFiles: true,
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
          '/mock/path/datasources/source-space/countries.dev.json': JSON.stringify([mockDatasource1]),
          '/mock/path/datasources/source-space/categories.dev.json': JSON.stringify([mockDatasource2]),
          '/mock/path/datasources/source-space/other.json': JSON.stringify([mockDatasource1]), // Should be ignored
        });

        const result = await readDatasourcesFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          separateFiles: true,
          suffix: 'dev',
          verbose: false,
        });

        expect(result.datasources).toHaveLength(2);
        // Don't rely on order since readdir doesn't guarantee specific order
        expect(result.datasources).toContainEqual(mockDatasource1);
        expect(result.datasources).toContainEqual(mockDatasource2);
      });

      it('should filter out consolidated files when reading separate files', async () => {
        // Create mock filesystem with mixed files
        vol.fromJSON({
          '/mock/path/datasources/source-space/countries.json': JSON.stringify([mockDatasource1]),
          '/mock/path/datasources/source-space/datasources.json': JSON.stringify([mockDatasource1, mockDatasource2]), // Should be ignored
          '/mock/path/datasources/source-space/datasources.dev.json': JSON.stringify([mockDatasource1, mockDatasource2]), // Should be ignored
        });

        const result = await readDatasourcesFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          separateFiles: true,
          verbose: false,
        });

        // Should only include the separate file, not the consolidated files
        expect(result.datasources).toHaveLength(1);
        expect(result.datasources[0]).toEqual(mockDatasource1);
      });

      it('should handle empty directory in separate files mode', async () => {
        // Create empty directory
        vol.fromJSON({
          '/mock/path/datasources/source-space/': null,
        });

        const result = await readDatasourcesFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          separateFiles: true,
          verbose: false,
        });

        expect(result.datasources).toHaveLength(0);
      });

      it('should handle files without suffix pattern correctly', async () => {
        // Create files with various patterns
        vol.fromJSON({
          '/mock/path/datasources/source-space/countries.json': JSON.stringify([mockDatasource1]),
          '/mock/path/datasources/source-space/categories.dev.json': JSON.stringify([mockDatasource2]), // Has suffix pattern, should be ignored when no suffix specified
          '/mock/path/datasources/source-space/simple.json': JSON.stringify([mockDatasource1]),
        });

        const result = await readDatasourcesFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          separateFiles: true,
          verbose: false,
        });

        // Should only include files without suffix pattern
        expect(result.datasources).toHaveLength(2);
      });

      it('should handle non-JSON files gracefully', async () => {
        // Create directory with mixed file types
        vol.fromJSON({
          '/mock/path/datasources/source-space/countries.json': JSON.stringify([mockDatasource1]),
          '/mock/path/datasources/source-space/readme.txt': 'This is a text file',
          '/mock/path/datasources/source-space/config.yaml': 'key: value',
        });

        const result = await readDatasourcesFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          separateFiles: true,
          verbose: false,
        });

        expect(result.datasources).toHaveLength(1);
        expect(result.datasources[0]).toEqual(mockDatasource1);
      });
    });

    describe('consolidated files mode', () => {
      it('should read datasources from consolidated file without suffix', async () => {
        // Create mock filesystem with consolidated file
        vol.fromJSON({
          '/mock/path/datasources/source-space/datasources.json': JSON.stringify([mockDatasource1, mockDatasource2]),
        });

        const result = await readDatasourcesFiles({
          from: 'source-space',
          path: '/mock/path',
          space: 'target-space',
          separateFiles: false,
          verbose: false,
        });

        expect(result.datasources).toHaveLength(2);
        // For consolidated files, the order should be preserved as stored in JSON
        expect(result.datasources[0]).toEqual(mockDatasource1);
        expect(result.datasources[1]).toEqual(mockDatasource2);
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
          separateFiles: false,
          suffix: 'dev',
          verbose: false,
        });

        expect(result.datasources).toHaveLength(2);
        // For consolidated files, the order should be preserved as stored in JSON
        expect(result.datasources[0]).toEqual(mockDatasource1);
        expect(result.datasources[1]).toEqual(mockDatasource2);
      });

      it('should throw error when consolidated file does not exist', async () => {
        // Create directory but no consolidated file
        vol.fromJSON({
          '/mock/path/datasources/source-space/': null,
        });

        await expect(
          readDatasourcesFiles({
            from: 'source-space',
            path: '/mock/path',
            space: 'target-space',
            separateFiles: false,
            verbose: false,
          }),
        ).rejects.toThrow(FileSystemError);
      });

      it('should throw error when consolidated file is empty', async () => {
        // Create empty consolidated file
        vol.fromJSON({
          '/mock/path/datasources/source-space/datasources.json': JSON.stringify([]),
        });

        await expect(
          readDatasourcesFiles({
            from: 'source-space',
            path: '/mock/path',
            space: 'target-space',
            separateFiles: false,
            verbose: false,
          }),
        ).rejects.toThrow(FileSystemError);

        try {
          await readDatasourcesFiles({
            from: 'source-space',
            path: '/mock/path',
            space: 'target-space',
            separateFiles: false,
            verbose: false,
          });
        }
        catch (error) {
          expect(error).toBeInstanceOf(FileSystemError);
          expect((error as FileSystemError).message).toContain('No datasources found');
          expect((error as FileSystemError).message).toContain('Please make sure you have pulled the datasources first');
        }
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
            separateFiles: false,
            verbose: false,
          }),
        ).rejects.toThrow();
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
          separateFiles: false,
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
          separateFiles: false,
          verbose: false,
        });

        expect(result.datasources).toHaveLength(2);
        expect(result.datasources).toContainEqual(mockDatasource1);
        expect(result.datasources).toContainEqual(mockDatasource2);
      });

      it('should use the target space as from space if from option is omitted', async () => {
        // When from is not specified, it should use the target space
        vol.fromJSON({
          '/mock/path/datasources/target-space/datasources.json': JSON.stringify([mockDatasource1, mockDatasource2]),
        });

        const result = await readDatasourcesFiles({
          from: undefined,
          path: '/mock/path',
          space: 'target-space',
          separateFiles: false,
          verbose: false,
        });

        expect(result.datasources).toHaveLength(2);
        expect(result.datasources).toContainEqual(mockDatasource1);
        expect(result.datasources).toContainEqual(mockDatasource2);
      });
    });
  });
});
